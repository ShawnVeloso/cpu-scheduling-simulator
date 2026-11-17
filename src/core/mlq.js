// mlq.js - Multilevel Queue with two fixed levels.
//
//   Queue 1 (foreground): Round Robin with a user-set time quantum.
//   Queue 2 (background): FCFS.
//
// The scheduling between the queues is fixed-priority and preemptive:
// queue 2 runs only while queue 1 is empty, and a queue 1 arrival takes the
// CPU from a queue 2 process at once.
//
// Queue rules (docs/DECISIONS.md D3):
//   5. In queue 1, a new arrival enters the queue before a process whose
//      time quantum expired at the same time unit.
//   6. A queue 2 process that loses the CPU goes back to the FRONT of
//      queue 2. Queue 2 is FCFS, so it has no quantum to reset.
//   7. With both queues empty, the CPU is idle until the next arrival.
//
// Both queues are plain arrays used as FIFO queues: push() to the back and
// shift() from the front.

import { TimelineBuilder, buildMetrics, IDLE } from './timeline.js';
import { comparePid } from './pid-order.js';

/**
 * Run the Multilevel Queue over a validated process list.
 * @param {object[]} inputProcesses - pid, arrival, burst, priority, queue
 * @param {{quantum: number}} options
 * @returns {{blocks, results, averages, events}}
 */
export function scheduleMLQ(inputProcesses, { quantum }) {
  // Work on copies, and keep the input order for equal arrival times.
  const processes = inputProcesses.map((p) => ({
    ...p,
    remaining: p.burst,
    completion: null,
    enqueued: false,
  }));

  // Arrivals enter their queue in order of arrival time, then of PID. The
  // PID order is the same one that Priority Scheduling uses (D3, rule 2).
  const byArrival = [...processes].sort(
    (a, b) => a.arrival - b.arrival || comparePid(a.pid, b.pid),
  );

  const queue1 = []; // foreground, Round Robin
  const queue2 = []; // background, FCFS
  const timeline = new TimelineBuilder();
  const events = [];

  let time = 0;
  let finished = 0;
  let running = null;
  let runningLevel = 0; // 1 or 2, so we know which rule applies
  let sliceLeft = 0;    // time units left in the Round Robin quantum
  let expired = null;   // a queue 1 process whose quantum ran out

  while (finished < processes.length) {
    // Step 1: every process that arrives now joins the back of its queue.
    for (const p of byArrival) {
      if (!p.enqueued && p.arrival <= time) {
        p.enqueued = true;
        (p.queue === 1 ? queue1 : queue2).push(p);
      }
    }

    // Step 2: rule 5 - the quantum-expired process enters AFTER the arrivals.
    if (expired !== null) {
      queue1.push(expired);
      expired = null;
    }

    // Step 3: a queue 1 arrival takes the CPU from a queue 2 process at once.
    if (running !== null && runningLevel === 2 && queue1.length > 0) {
      events.push({
        time,
        type: 'preempt',
        from: running.pid,
        to: queue1[0].pid,
        remaining: running.remaining,
      });
      timeline.markPreempted();
      queue2.unshift(running); // rule 6: back to the FRONT of queue 2
      running = null;
    }

    // Step 4: dispatch. Queue 2 runs only while queue 1 is empty.
    if (running === null) {
      if (queue1.length > 0) {
        running = queue1.shift();
        runningLevel = 1;
        sliceLeft = quantum;
      } else if (queue2.length > 0) {
        running = queue2.shift();
        runningLevel = 2;
        sliceLeft = Infinity; // FCFS runs until it ends or queue 1 takes over
      }
    }

    if (running === null) {
      // Rule 7: both queues are empty, so the CPU idles for this time unit.
      timeline.add(IDLE, time);
      time += 1;
      continue;
    }

    // The process on the CPU holds it for one time unit.
    timeline.add(running.pid, time);
    running.remaining -= 1;
    sliceLeft -= 1;
    time += 1;

    if (running.remaining === 0) {
      running.completion = time;
      finished += 1;
      running = null;
    } else if (runningLevel === 1 && sliceLeft === 0) {
      // The quantum ran out. The process waits for step 2 of the next loop,
      // so any process arriving at this same time unit queues ahead of it.
      events.push({
        time,
        type: 'quantum',
        from: running.pid,
        remaining: running.remaining,
      });
      expired = running;
      running = null;
    }
  }

  const blocks = timeline.build();
  const { results, averages } = buildMetrics(processes, blocks);
  return { blocks, results, averages, events };
}
