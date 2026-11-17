// priority.js - Priority Scheduling, non-preemptive and preemptive.
//
// The two algorithms share one function because they differ in one place
// only: the non-preemptive version keeps the CPU until the process ends,
// and the preemptive version makes a new dispatch decision every time unit.
//
// Tie-breaking (docs/DECISIONS.md D3):
//   1. A lower priority number is a higher priority.
//   2. Equal priority -> the earlier arrival wins, then the lower PID.
//   3. A different process takes a running CPU only with a STRICTLY higher
//      priority. An equal priority does not preempt.
//   4. A preempted process keeps its remaining burst and its arrival time.
//   7. With nothing ready, the CPU is idle until the next arrival.

import { TimelineBuilder, buildMetrics, IDLE } from './timeline.js';
import { comparePid } from './pid-order.js';

/**
 * Compare two ready processes with rules 1 and 2.
 * @returns true when `a` must run before `b`.
 */
function isBetter(a, b) {
  if (a.priority !== b.priority) return a.priority < b.priority; // rule 1
  if (a.arrival !== b.arrival) return a.arrival < b.arrival;     // rule 2
  return comparePid(a.pid, b.pid) < 0;                           // rule 2
}

/**
 * Pick the process that must hold the CPU at time `time`.
 * `running` is the process on the CPU, or null when the CPU is free.
 */
function pickProcess(processes, time, running) {
  let best = null;
  for (const p of processes) {
    // The ready set: the process has arrived and still has work left.
    if (p.arrival > time || p.remaining === 0) continue;
    if (best === null || isBetter(p, best)) best = p;
  }
  if (best === null) return null;

  // Rule 3: hold the CPU unless the best candidate is strictly better.
  if (running !== null && running.remaining > 0 && best.priority >= running.priority) {
    return running;
  }
  return best;
}

/**
 * Run Priority Scheduling over a validated process list.
 * @param {object[]} inputProcesses - pid, arrival, burst, priority, queue
 * @param {{preemptive: boolean}} options
 * @returns {{blocks, results, averages, events}}
 */
export function schedulePriority(inputProcesses, { preemptive }) {
  // Work on copies. The caller's data must not change. (pure core)
  const processes = inputProcesses.map((p) => ({
    ...p,
    remaining: p.burst,
    completion: null,
  }));

  const timeline = new TimelineBuilder();
  const events = [];
  let time = 0;
  let finished = 0;
  let running = null;

  while (finished < processes.length) {
    if (preemptive || running === null) {
      // Preemptive: decide again at every time unit, so an arrival can take
      // the CPU at the exact moment it arrives.
      const next = pickProcess(processes, time, running);
      if (running !== null && next !== running) {
        // The running process loses the CPU with burst left: a preemption.
        events.push({
          time,
          type: 'preempt',
          from: running.pid,
          to: next === null ? IDLE : next.pid,
          remaining: running.remaining,
        });
        timeline.markPreempted();
      }
      running = next;
    }

    if (running === null) {
      // Rule 7: no process is ready, so the CPU idles for this time unit.
      timeline.add(IDLE, time);
      time += 1;
      continue;
    }

    // Dispatch: the chosen process holds the CPU for one time unit.
    timeline.add(running.pid, time);
    running.remaining -= 1;
    time += 1;

    if (running.remaining === 0) {
      running.completion = time;
      finished += 1;
      running = null; // the CPU is free, so the next loop dispatches again
    }
  }

  const blocks = timeline.build();
  const { results, averages } = buildMetrics(processes, blocks);
  return { blocks, results, averages, events };
}
