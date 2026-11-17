// run-tests.js - tests for the scheduling core. Run with: node tests/run-tests.js
//
// Every algorithm is tested on the cases the project brief calls edge cases:
// simultaneous arrivals, a non-zero first arrival, idle gaps, equal keys,
// and a single process. The expected numbers were calculated by hand first.

import {
  runSimulation,
  validateInput,
  timelineIsContinuous,
} from '../src/core/index.js';
import { parseProcessFile } from '../src/ui/parse-file.js';
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed += 1;
    console.log('  PASS  ' + name);
  } else {
    failed += 1;
    console.log('  FAIL  ' + name);
    console.log('        expected ' + e);
    console.log('        actual   ' + a);
  }
}

function blocksOf(sim) {
  return sim.blocks.map((b) => b.label + ':' + b.start + '-' + b.end);
}

function tableOf(sim) {
  return sim.results.map((r) => r.pid + ' C' + r.completion + ' T' + r.turnaround + ' W' + r.waiting);
}

function run(rows, options) {
  const out = runSimulation(rows, options);
  if (!out.ok) throw new Error('unexpected validation errors: ' + out.errors.join(' '));
  return out.simulation;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
console.log('\nPriority Scheduling (Non-preemptive)');

{
  // Hand-checked set: equal priorities (P3 and P4), and an idle gap at 14-16.
  const rows = [
    { pid: 'P1', arrival: 0, burst: 5, priority: 2 },
    { pid: 'P2', arrival: 1, burst: 3, priority: 1 },
    { pid: 'P3', arrival: 2, burst: 4, priority: 3 },
    { pid: 'P4', arrival: 3, burst: 2, priority: 3 },
    { pid: 'P5', arrival: 16, burst: 3, priority: 2 },
  ];
  const sim = run(rows, { algorithm: 'priority-np' });
  check('main set: Gantt blocks', blocksOf(sim), [
    'P1:0-5', 'P2:5-8', 'P3:8-12', 'P4:12-14', 'IDLE:14-16', 'P5:16-19',
  ]);
  check('main set: per-process metrics', tableOf(sim), [
    'P1 C5 T5 W0', 'P2 C8 T7 W4', 'P3 C12 T10 W6', 'P4 C14 T11 W9', 'P5 C19 T3 W0',
  ]);
  check('main set: averages', [round(sim.averages.avgTurnaround), round(sim.averages.avgWaiting)], [7.2, 3.8]);
  check('main set: CPU utilization', round(sim.averages.cpuUtilization), 89.47);
  check('main set: timeline is continuous', timelineIsContinuous(sim.blocks), true);
  check('main set: no preemption happens', sim.events.length, 0);
  check('main set: the input list is unchanged', rows[0].burst, 5);
}

{
  // Equal priority AND equal arrival: the lower PID runs first (rule 2).
  const sim = run([
    { pid: 'P2', arrival: 0, burst: 2, priority: 1 },
    { pid: 'P1', arrival: 0, burst: 3, priority: 1 },
  ], { algorithm: 'priority-np' });
  check('equal priority and arrival: lower PID first', blocksOf(sim), ['P1:0-3', 'P2:3-5']);
}

{
  // A low-priority process that is already running is NOT interrupted.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 5, priority: 9 },
    { pid: 'P2', arrival: 1, burst: 2, priority: 1 },
  ], { algorithm: 'priority-np' });
  check('a running process keeps the CPU', blocksOf(sim), ['P1:0-5', 'P2:5-7']);
}

{
  const sim = run([{ pid: 'P1', arrival: 4, burst: 3, priority: 1 }], { algorithm: 'priority-np' });
  check('single process, late arrival: idle first', blocksOf(sim), ['IDLE:0-4', 'P1:4-7']);
  check('single process: metrics', tableOf(sim), ['P1 C7 T3 W0']);
}

// ---------------------------------------------------------------------------
console.log('\nPriority Scheduling (Preemptive)');

{
  // The dataset from the Progress Report 1 wireframe, checked by hand.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 4, priority: 3 },
    { pid: 'P2', arrival: 1, burst: 3, priority: 1 },
    { pid: 'P3', arrival: 2, burst: 2, priority: 4 },
    { pid: 'P4', arrival: 10, burst: 2, priority: 2 },
  ], { algorithm: 'priority-p' });
  check('wireframe set: Gantt blocks', blocksOf(sim), [
    'P1:0-1', 'P2:1-4', 'P1:4-7', 'P3:7-9', 'IDLE:9-10', 'P4:10-12',
  ]);
  check('wireframe set: per-process metrics', tableOf(sim), [
    'P1 C7 T7 W3', 'P2 C4 T3 W0', 'P3 C9 T7 W5', 'P4 C12 T2 W0',
  ]);
  check('wireframe set: averages', [round(sim.averages.avgTurnaround), round(sim.averages.avgWaiting)], [4.75, 2]);
  check('wireframe set: CPU utilization', round(sim.averages.cpuUtilization), 91.67);
  check('wireframe set: one preemption at time 1',
    sim.events.map((e) => e.type + '@' + e.time + ' ' + e.from + '->' + e.to),
    ['preempt@1 P1->P2']);
  check('wireframe set: the first block is marked preempted', sim.blocks[0].preempted, true);
  check('wireframe set: timeline is continuous', timelineIsContinuous(sim.blocks), true);
}

{
  // Rule 3: an EQUAL priority arrival must not take the CPU.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 4, priority: 2 },
    { pid: 'P2', arrival: 1, burst: 2, priority: 2 },
  ], { algorithm: 'priority-p' });
  check('equal priority does not preempt', blocksOf(sim), ['P1:0-4', 'P2:4-6']);
  check('equal priority: no preempt event', sim.events.length, 0);
}

{
  // Rule 4: the preempted process keeps its remaining burst.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 6, priority: 5 },
    { pid: 'P2', arrival: 2, burst: 2, priority: 1 },
  ], { algorithm: 'priority-p' });
  check('preempted process resumes with the burst left', blocksOf(sim), ['P1:0-2', 'P2:2-4', 'P1:4-8']);
  check('preempted process: metrics', tableOf(sim), ['P1 C8 T8 W2', 'P2 C4 T2 W0']);
}

{
  // Three processes arrive at the same time unit (simultaneous arrivals).
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 2, priority: 3 },
    { pid: 'P2', arrival: 0, burst: 2, priority: 1 },
    { pid: 'P3', arrival: 0, burst: 2, priority: 2 },
  ], { algorithm: 'priority-p' });
  check('simultaneous arrivals run in priority order', blocksOf(sim), ['P2:0-2', 'P3:2-4', 'P1:4-6']);
}

// ---------------------------------------------------------------------------
console.log('\nMultilevel Queue (Q1 = Round Robin, Q2 = FCFS)');

{
  // Hand-checked: Q1 takes the CPU from Q2 at time 3, Q2 resumes at the end.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 4, queue: 2 },
    { pid: 'P2', arrival: 3, burst: 3, queue: 1 },
    { pid: 'P3', arrival: 4, burst: 2, queue: 1 },
  ], { algorithm: 'mlq', quantum: 2 });
  check('MLQ set: Gantt blocks', blocksOf(sim), [
    'P1:0-3', 'P2:3-5', 'P3:5-7', 'P2:7-8', 'P1:8-9',
  ]);
  check('MLQ set: per-process metrics', tableOf(sim), [
    'P1 C9 T9 W5', 'P2 C8 T5 W2', 'P3 C7 T3 W1',
  ]);
  check('MLQ set: averages', [round(sim.averages.avgTurnaround), round(sim.averages.avgWaiting)], [5.67, 2.67]);
  check('MLQ set: a Q1 arrival takes the CPU from Q2 at time 3',
    sim.events.filter((e) => e.type === 'preempt').map((e) => e.time + ' ' + e.from + '->' + e.to),
    ['3 P1->P2']);
  check('MLQ set: timeline is continuous', timelineIsContinuous(sim.blocks), true);
}

{
  // Rule 5: at time 2 the new arrival P2 enters queue 1 BEFORE the
  // quantum-expired P1, so P2 runs next.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 4, queue: 1 },
    { pid: 'P2', arrival: 2, burst: 2, queue: 1 },
  ], { algorithm: 'mlq', quantum: 2 });
  check('rule 5: the new arrival queues ahead of the expired process',
    blocksOf(sim), ['P1:0-2', 'P2:2-4', 'P1:4-6']);
  check('rule 5: metrics', tableOf(sim), ['P1 C6 T6 W2', 'P2 C4 T2 W0']);
}

{
  // Only queue 2 is used, so the MLQ is plain FCFS, with an idle gap.
  const sim = run([
    { pid: 'P1', arrival: 1, burst: 2, queue: 2 },
    { pid: 'P2', arrival: 7, burst: 3, queue: 2 },
  ], { algorithm: 'mlq', quantum: 3 });
  check('queue 2 only: FCFS with idle gaps', blocksOf(sim), ['IDLE:0-1', 'P1:1-3', 'IDLE:3-7', 'P2:7-10']);
  check('queue 2 only: CPU utilization', round(sim.averages.cpuUtilization), 50);
}

{
  const sim = run([{ pid: 'P1', arrival: 0, burst: 5, queue: 1 }], { algorithm: 'mlq', quantum: 2 });
  check('single process in Round Robin stays one block', blocksOf(sim), ['P1:0-5']);
}

{
  // The MLQ sample set of the GUI. It holds a preemption of queue 2 by
  // queue 1, two Round Robin slices, and an idle gap at 9-10.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 4, queue: 2 },
    { pid: 'P2', arrival: 3, burst: 3, queue: 1 },
    { pid: 'P3', arrival: 4, burst: 2, queue: 1 },
    { pid: 'P4', arrival: 10, burst: 3, queue: 2 },
  ], { algorithm: 'mlq', quantum: 2 });
  check('GUI sample: Gantt blocks', blocksOf(sim), [
    'P1:0-3', 'P2:3-5', 'P3:5-7', 'P2:7-8', 'P1:8-9', 'IDLE:9-10', 'P4:10-13',
  ]);
  check('GUI sample: per-process metrics', tableOf(sim), [
    'P1 C9 T9 W5', 'P2 C8 T5 W2', 'P3 C7 T3 W1', 'P4 C13 T3 W0',
  ]);
  check('GUI sample: averages', [round(sim.averages.avgTurnaround), round(sim.averages.avgWaiting)], [5, 2]);
  check('GUI sample: CPU utilization', round(sim.averages.cpuUtilization), 92.31);
}

// ---------------------------------------------------------------------------
console.log('\nPID order (D3 rule 2: P2 is a lower PID than P10)');

{
  // Equal priority and equal arrival. A text comparison would put P10 first.
  const sim = run([
    { pid: 'P10', arrival: 0, burst: 2, priority: 1 },
    { pid: 'P2', arrival: 0, burst: 2, priority: 1 },
    { pid: 'P1', arrival: 0, burst: 2, priority: 1 },
  ], { algorithm: 'priority-np' });
  check('priority: P1, then P2, then P10', blocksOf(sim), ['P1:0-2', 'P2:2-4', 'P10:4-6']);
}

{
  // Equal arrival in queue 1. The lower PID enters the queue first.
  const sim = run([
    { pid: 'P10', arrival: 0, burst: 2, queue: 1 },
    { pid: 'P2', arrival: 0, burst: 2, queue: 1 },
  ], { algorithm: 'mlq', quantum: 5 });
  check('MLQ: P2 enters the queue before P10', blocksOf(sim), ['P2:0-2', 'P10:2-4']);
}

// ---------------------------------------------------------------------------
console.log('\nEdge-case set (samples/sample-edge-cases.csv), all three algorithms');

{
  // One set with every edge case: a non-zero first arrival (idle at 0-2),
  // two processes that arrive together with an equal priority (P1 and P2),
  // an idle gap (15-20), and an arrival that preempts (P3 and P6).
  // The expected numbers were calculated by hand.
  const text = readFileSync(new URL('../samples/sample-edge-cases.csv', import.meta.url), 'utf8');
  const rows = parseProcessFile(text);
  check('edge set: the file holds 6 processes', rows.length, 6);

  const np = run(rows, { algorithm: 'priority-np' });
  check('edge set, non-preemptive: Gantt blocks', blocksOf(np), [
    'IDLE:0-2', 'P1:2-8', 'P3:8-11', 'P2:11-13', 'P4:13-15', 'IDLE:15-20', 'P5:20-24', 'P6:24-26',
  ]);
  check('edge set, non-preemptive: per-process metrics', tableOf(np), [
    'P1 C8 T6 W0', 'P2 C13 T11 W9', 'P3 C11 T7 W4', 'P4 C15 T10 W8', 'P5 C24 T4 W0', 'P6 C26 T5 W3',
  ]);
  check('edge set, non-preemptive: averages',
    [round(np.averages.avgTurnaround), round(np.averages.avgWaiting)], [7.17, 4]);
  check('edge set, non-preemptive: CPU utilization', round(np.averages.cpuUtilization), 73.08);

  const p = run(rows, { algorithm: 'priority-p' });
  check('edge set, preemptive: Gantt blocks', blocksOf(p), [
    'IDLE:0-2', 'P1:2-4', 'P3:4-7', 'P1:7-11', 'P2:11-13', 'P4:13-15',
    'IDLE:15-20', 'P5:20-21', 'P6:21-23', 'P5:23-26',
  ]);
  check('edge set, preemptive: per-process metrics', tableOf(p), [
    'P1 C11 T9 W3', 'P2 C13 T11 W9', 'P3 C7 T3 W0', 'P4 C15 T10 W8', 'P5 C26 T6 W2', 'P6 C23 T2 W0',
  ]);
  check('edge set, preemptive: averages',
    [round(p.averages.avgTurnaround), round(p.averages.avgWaiting)], [6.83, 3.67]);
  check('edge set, preemptive: two preemptions',
    p.events.map((e) => e.time + ' ' + e.from + '->' + e.to), ['4 P1->P3', '21 P5->P6']);

  const mlq = run(rows, { algorithm: 'mlq', quantum: 2 });
  check('edge set, MLQ: Gantt blocks', blocksOf(mlq), [
    'IDLE:0-2', 'P2:2-4', 'P3:4-7', 'P1:7-13', 'P4:13-15',
    'IDLE:15-20', 'P5:20-21', 'P6:21-23', 'P5:23-26',
  ]);
  check('edge set, MLQ: per-process metrics', tableOf(mlq), [
    'P1 C13 T11 W5', 'P2 C4 T2 W0', 'P3 C7 T3 W0', 'P4 C15 T10 W8', 'P5 C26 T6 W2', 'P6 C23 T2 W0',
  ]);
  check('edge set, MLQ: averages',
    [round(mlq.averages.avgTurnaround), round(mlq.averages.avgWaiting)], [5.67, 2.5]);

  check('edge set: all three timelines are continuous',
    [np, p, mlq].map((sim) => timelineIsContinuous(sim.blocks)), [true, true, true]);
}

// ---------------------------------------------------------------------------
console.log('\nMore hand-checked cases');

{
  // Two preemptions in a row. Rule 4: at time 4, P2 and P4 have an equal
  // priority. P2 keeps its original arrival time (1), so it runs before P4.
  const sim = run([
    { pid: 'P1', arrival: 0, burst: 5, priority: 4 },
    { pid: 'P2', arrival: 1, burst: 4, priority: 3 },
    { pid: 'P3', arrival: 2, burst: 2, priority: 1 },
    { pid: 'P4', arrival: 3, burst: 2, priority: 3 },
    { pid: 'P5', arrival: 20, burst: 1, priority: 9 },
  ], { algorithm: 'priority-p' });
  check('preemption chain: Gantt blocks', blocksOf(sim), [
    'P1:0-1', 'P2:1-2', 'P3:2-4', 'P2:4-7', 'P4:7-9', 'P1:9-13', 'IDLE:13-20', 'P5:20-21',
  ]);
  check('preemption chain: per-process metrics', tableOf(sim), [
    'P1 C13 T13 W8', 'P2 C7 T6 W2', 'P3 C4 T2 W0', 'P4 C9 T6 W4', 'P5 C21 T1 W0',
  ]);
  check('preemption chain: averages',
    [round(sim.averages.avgTurnaround), round(sim.averages.avgWaiting)], [5.6, 2.8]);
}

{
  // Rule 6 with a second process in queue 2. A loses the CPU at time 1 and
  // returns to the FRONT of queue 2, so A runs before D when queue 1 empties.
  // In queue 1, B and C use Round Robin with a time quantum of 2.
  const sim = run([
    { pid: 'A', arrival: 0, burst: 5, queue: 2 },
    { pid: 'B', arrival: 1, burst: 5, queue: 1 },
    { pid: 'C', arrival: 2, burst: 1, queue: 1 },
    { pid: 'D', arrival: 2, burst: 2, queue: 2 },
  ], { algorithm: 'mlq', quantum: 2 });
  check('rule 6: the preempted process resumes before the next one in queue 2',
    blocksOf(sim), ['A:0-1', 'B:1-3', 'C:3-4', 'B:4-7', 'A:7-11', 'D:11-13']);
  check('rule 6: per-process metrics', tableOf(sim), [
    'A C11 T11 W6', 'B C7 T6 W1', 'C C4 T2 W1', 'D C13 T11 W9',
  ]);
  check('rule 6: averages',
    [round(sim.averages.avgTurnaround), round(sim.averages.avgWaiting)], [7.5, 4.25]);
}

{
  // The long sample has 12 processes. The sums must agree with the timeline.
  const text = readFileSync(new URL('../samples/sample-long.csv', import.meta.url), 'utf8');
  const rows = parseProcessFile(text);
  for (const options of [{ algorithm: 'priority-np' }, { algorithm: 'priority-p' }, { algorithm: 'mlq', quantum: 3 }]) {
    const sim = run(rows, options);
    const totalBurst = sim.results.reduce((sum, r) => sum + r.burst, 0);
    check('long set, ' + options.algorithm + ': continuous, and busy time = total burst',
      [timelineIsContinuous(sim.blocks), sim.averages.busyTime], [true, totalBurst]);
  }
}

// ---------------------------------------------------------------------------
console.log('\nInput validation');

{
  const reserved = validateInput([{ pid: 'idle', arrival: 0, burst: 2, priority: 1 }], { algorithm: 'priority-np' });
  check('the PID "IDLE" is rejected', reserved.errors, ['Row 1: the Process ID "idle" is reserved for the idle CPU.']);
}

{
  const tooBig = validateInput([{ pid: 'P1', arrival: 100001, burst: 999999999999, priority: 1 }], { algorithm: 'priority-np' });
  check('a time above the limit is rejected', tooBig.errors, [
    'Row 1: the arrival time must be 100000 or less.',
    'Row 1: the burst time must be 100000 or less.',
  ]);
}

{
  const missing = validateInput([null], { algorithm: 'priority-np' });
  check('a missing row gives messages, not a crash', missing.ok, false);
}

{
  const bad = validateInput([
    { pid: '', arrival: -1, burst: 0, priority: 1 },
    { pid: 'P2', arrival: 'x', burst: 2.5, priority: 0 },
  ], { algorithm: 'priority-np' });
  check('bad input is rejected', bad.ok, false);
  check('bad input: one message per problem', bad.errors.length, 6);
}

{
  const dup = validateInput([
    { pid: 'P1', arrival: 0, burst: 2, priority: 1 },
    { pid: 'P1', arrival: 1, burst: 2, priority: 1 },
  ], { algorithm: 'priority-np' });
  check('a duplicate PID is rejected', dup.errors, ['Row 2: the Process ID "P1" is a duplicate.']);
}

{
  const noQuantum = validateInput([{ pid: 'P1', arrival: 0, burst: 2, queue: 1 }], { algorithm: 'mlq' });
  check('the MLQ without a quantum is rejected', noQuantum.errors, ['The Multilevel Queue needs a time quantum.']);
}

{
  const badQueue = validateInput([{ pid: 'P1', arrival: 0, burst: 2, queue: 3 }], { algorithm: 'mlq', quantum: 2 });
  check('a queue that is not 1 or 2 is rejected', badQueue.errors, ['Row 1: the queue must be 1 (foreground) or 2 (background).']);
}

{
  const empty = validateInput([], { algorithm: 'priority-np' });
  check('an empty table is rejected', empty.errors, ['Add at least one process.']);
}

{
  const good = validateInput([{ pid: 'P1', arrival: '0', burst: '4', priority: '2' }], { algorithm: 'priority-np' });
  check('text from the GUI becomes numbers', good.processes[0], { pid: 'P1', arrival: 0, burst: 4, priority: 2, queue: 1 });
}

// ---------------------------------------------------------------------------
console.log('\nFile upload');

{
  // The sample file on the disk must reach the core and give a result.
  const text = readFileSync(new URL('../samples/sample-priority.csv', import.meta.url), 'utf8');
  const rows = parseProcessFile(text);
  check('the comment lines and the header line are skipped', rows.length, 4);
  check('the first row is read correctly', rows[0],
    { pid: 'P1', arrival: '0', burst: '4', priority: '3', queue: '1' });

  const sim = run(rows, { algorithm: 'priority-p' });
  check('the uploaded file produces the expected timeline', blocksOf(sim), [
    'P1:0-1', 'P2:1-4', 'P1:4-7', 'P3:7-9', 'IDLE:9-10', 'P4:10-12',
  ]);
}

{
  const rows = parseProcessFile('P1;0;4;2;1\nP2\t1\t3\t1\t1\n');
  check('a semicolon and a tab also separate the fields', rows.length, 2);
}

{
  check('an empty file gives no process', parseProcessFile('\n\n# only a comment\n'), []);
}

// ---------------------------------------------------------------------------
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
