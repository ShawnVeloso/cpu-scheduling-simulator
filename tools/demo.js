// demo.js - console proof that the scheduling core works.
// Run with: node tools/demo.js
//
// This script has no GUI. It feeds a hard-coded process set into the core
// and prints the Gantt timeline, the per-process metrics, and the averages.

import { runSimulation, IDLE } from '../src/core/index.js';

const LINE = '='.repeat(78);

// Hard-coded test set. It holds the edge cases the project brief asks for:
//   - a non-zero first arrival for P2 to P5
//   - two processes with the SAME priority 3 (P3 and P4)
//   - a gap with no ready process, so the CPU must idle
const PROCESSES = [
  { pid: 'P1', arrival: 0, burst: 5, priority: 2, queue: 1 },
  { pid: 'P2', arrival: 1, burst: 3, priority: 1, queue: 1 },
  { pid: 'P3', arrival: 2, burst: 4, priority: 3, queue: 2 },
  { pid: 'P4', arrival: 3, burst: 2, priority: 3, queue: 2 },
  { pid: 'P5', arrival: 16, burst: 3, priority: 2, queue: 1 },
];

// The results we calculated by hand before we wrote the code.
const HAND_CHECK = {
  completion: { P1: 5, P2: 8, P3: 12, P4: 14, P5: 19 },
  avgTurnaround: 7.2,
  avgWaiting: 3.8,
};

function pad(value, width) {
  return String(value).padStart(width);
}

function printInput() {
  console.log('INPUT PROCESSES (hard-coded)');
  console.log('  PID   Arrival   Burst   Priority');
  console.log('  ' + '-'.repeat(34));
  for (const p of PROCESSES) {
    console.log('  ' + p.pid.padEnd(6) + pad(p.arrival, 7) + pad(p.burst, 8) + pad(p.priority, 11));
  }
  console.log('');
  console.log('  Rule: a LOWER priority number is a HIGHER priority.');
  console.log('  Tie on priority: the earlier arrival runs first, then the lower PID.');
  console.log('');
}

// Draw the timeline as ASCII. Every time unit from 0 to the end belongs to
// exactly one block, so the chart has no gap and no overlap.
function printGantt(blocks) {
  console.log('GANTT CHART (execution timeline)');
  console.log('');
  let top = '  ';
  let mid = '  |';
  let axis = '  0';
  for (const block of blocks) {
    const units = block.end - block.start;
    const width = units * 3;
    const label = block.label === IDLE ? 'IDLE' : block.label;
    const cell = label.padStart(Math.floor((width + label.length) / 2)).padEnd(width);
    top += '+' + '-'.repeat(width);
    mid += cell + '|';
    axis += String(block.end).padStart(width + 1);
  }
  console.log(top + '+');
  console.log(mid);
  console.log(top + '+');
  console.log(axis);
  console.log('');
}

function printTable(sim) {
  console.log('PER-PROCESS RESULTS');
  console.log('  PID   Arrival   Burst   Priority   Completion    TAT     WT');
  console.log('  ' + '-'.repeat(62));
  for (const r of sim.results) {
    console.log(
      '  ' + r.pid.padEnd(6) + pad(r.arrival, 7) + pad(r.burst, 8) + pad(r.priority, 11) +
      pad(r.completion, 13) + pad(r.turnaround, 7) + pad(r.waiting, 7),
    );
  }
  console.log('  ' + '-'.repeat(62));
  console.log('  Formulas:  TAT = Completion - Arrival      WT = TAT - Burst');
  console.log('');
}

function printAverages(sim) {
  const a = sim.averages;
  console.log('SYSTEM AVERAGES');
  console.log('  Average Turnaround Time : ' + a.avgTurnaround.toFixed(2));
  console.log('  Average Waiting Time    : ' + a.avgWaiting.toFixed(2));
  console.log('  CPU Utilization         : ' + a.cpuUtilization.toFixed(2) + '%  (' +
    a.busyTime + ' busy of ' + a.totalTime + ' total time units)');
  console.log('');
}

// Compare the output with the numbers we calculated by hand.
function printHandCheck(sim) {
  console.log('HAND-CALCULATION CHECK');
  let allMatch = true;
  for (const r of sim.results) {
    const expected = HAND_CHECK.completion[r.pid];
    const match = expected === r.completion;
    if (!match) allMatch = false;
    console.log('  ' + r.pid + ' completion: by hand ' + pad(expected, 3) +
      '  |  by code ' + pad(r.completion, 3) + '   ' + (match ? '[MATCH]' : '[DIFFERENT]'));
  }
  const avgTatMatch = Number(sim.averages.avgTurnaround.toFixed(2)) === HAND_CHECK.avgTurnaround;
  const avgWtMatch = Number(sim.averages.avgWaiting.toFixed(2)) === HAND_CHECK.avgWaiting;
  if (!avgTatMatch || !avgWtMatch) allMatch = false;
  console.log('  Average TAT: by hand ' + HAND_CHECK.avgTurnaround.toFixed(2) +
    '  |  by code ' + sim.averages.avgTurnaround.toFixed(2) + '   ' + (avgTatMatch ? '[MATCH]' : '[DIFFERENT]'));
  console.log('  Average WT : by hand ' + HAND_CHECK.avgWaiting.toFixed(2) +
    '  |  by code ' + sim.averages.avgWaiting.toFixed(2) + '   ' + (avgWtMatch ? '[MATCH]' : '[DIFFERENT]'));
  console.log('');
  console.log('  RESULT: ' + (allMatch ? 'the code agrees with the hand calculation.' : 'a value is different.'));
  console.log('');
}

// Show that bad input gives a message and does not crash the program.
function printValidationDemo() {
  console.log(LINE);
  console.log('ROBUSTNESS CHECK: the core rejects invalid input');
  console.log(LINE);
  const bad = [
    { pid: 'P1', arrival: -2, burst: 4, priority: 1 },
    { pid: 'P1', arrival: 3, burst: 0, priority: 1 },
    { pid: 'P3', arrival: 5, burst: 2, priority: 0 },
  ];
  const out = runSimulation(bad, { algorithm: 'priority-np' });
  console.log('  Simulation ran: ' + out.ok);
  for (const message of out.errors) {
    console.log('  ERROR  ' + message);
  }
  console.log('');
}

// ---------------------------------------------------------------------------
console.log('');
console.log(LINE);
console.log('CPU SCHEDULING SIMULATOR - BACKEND CORE TEST');
console.log('CS 3104N Operating Systems | Group 12 | Veloso & Martinez');
console.log(LINE);
console.log('');

const output = runSimulation(PROCESSES, { algorithm: 'priority-np' });
if (!output.ok) {
  console.log('The input is not valid:');
  for (const message of output.errors) console.log('  - ' + message);
  process.exit(1);
}
const sim = output.simulation;

console.log('ALGORITHM: ' + sim.algorithmName);
console.log('');
printInput();
console.log(LINE);
printGantt(sim.blocks);
printTable(sim);
printAverages(sim);
printHandCheck(sim);
printValidationDemo();
console.log(LINE);
console.log('END OF BACKEND TEST');
console.log(LINE);
console.log('');
