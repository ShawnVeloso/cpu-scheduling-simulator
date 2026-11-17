// app.js - the browser user interface.
//
// This file reads the form, calls the scheduling core, and draws the result.
// It holds no scheduling logic. All the scheduling decisions happen in
// src/core/, which never touches the DOM.

import { runSimulation, IDLE } from '../core/index.js';
import { parseProcessFile } from './parse-file.js';

// One colour for each process, in the order the rows appear.
const COLORS = [
  '#4f8fd6', '#e07a5f', '#5fae7f', '#9b7ad1', '#d99a2b',
  '#4aa8b0', '#c2608f', '#7a8b9c', '#7f9f3a', '#b5563f',
];

// One sample set for each algorithm. Each set holds the edge cases we test:
// a non-zero arrival, an idle gap, and either equal keys or a preemption.
const SAMPLES = {
  'priority-np': [
    { pid: 'P1', arrival: 0, burst: 5, priority: 2, queue: 1 },
    { pid: 'P2', arrival: 1, burst: 3, priority: 1, queue: 1 },
    { pid: 'P3', arrival: 2, burst: 4, priority: 3, queue: 2 },
    { pid: 'P4', arrival: 3, burst: 2, priority: 3, queue: 2 },
    { pid: 'P5', arrival: 16, burst: 3, priority: 2, queue: 1 },
  ],
  'priority-p': [
    { pid: 'P1', arrival: 0, burst: 4, priority: 3, queue: 1 },
    { pid: 'P2', arrival: 1, burst: 3, priority: 1, queue: 1 },
    { pid: 'P3', arrival: 2, burst: 2, priority: 4, queue: 2 },
    { pid: 'P4', arrival: 10, burst: 2, priority: 2, queue: 2 },
  ],
  mlq: [
    { pid: 'P1', arrival: 0, burst: 4, priority: 1, queue: 2 },
    { pid: 'P2', arrival: 3, burst: 3, priority: 1, queue: 1 },
    { pid: 'P3', arrival: 4, burst: 2, priority: 1, queue: 1 },
    { pid: 'P4', arrival: 10, burst: 3, priority: 1, queue: 2 },
  ],
};

const el = (id) => document.getElementById(id);
const algorithmBox = el('algorithm');
const quantumBox = el('quantum');
const inputBody = el('input-body');
const errorCard = el('errors');
const errorList = el('error-list');
const ganttArea = el('gantt-area');
const metricsArea = el('metrics-area');

let rowCount = 0;

// ---------------------------------------------------------------------------
// Input table
// ---------------------------------------------------------------------------

function cell(value, name, extraClass) {
  const td = document.createElement('td');
  if (extraClass) td.className = extraClass;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.dataset.field = name;
  td.append(input);
  return td;
}

function addRow(process = {}) {
  rowCount += 1;
  const tr = document.createElement('tr');
  tr.append(
    cell(process.pid ?? 'P' + rowCount, 'pid'),
    cell(process.arrival ?? 0, 'arrival'),
    cell(process.burst ?? 1, 'burst'),
    cell(process.priority ?? 1, 'priority', 'priority-col'),
    cell(process.queue ?? 1, 'queue', 'queue-col'),
  );

  const action = document.createElement('td');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'del';
  remove.textContent = '✕';
  remove.title = 'Remove this process';
  remove.addEventListener('click', () => tr.remove());
  action.append(remove);
  tr.append(action);

  inputBody.append(tr);
  applyColumnState();
}

/** Read the table into plain rows. The core does the checking, not the UI. */
function readRows() {
  return [...inputBody.rows].map((tr) => {
    const row = {};
    for (const input of tr.querySelectorAll('input')) {
      row[input.dataset.field] = input.value;
    }
    return row;
  });
}

function setRows(processes) {
  inputBody.replaceChildren();
  rowCount = 0;
  processes.forEach((p) => addRow(p));
}

/** Grey out the columns the selected algorithm does not use. */
function applyColumnState() {
  const algorithm = algorithmBox.value;
  const usesPriority = algorithm === 'priority-np' || algorithm === 'priority-p';
  const usesQueue = algorithm === 'mlq';

  quantumBox.disabled = !usesQueue;
  for (const node of document.querySelectorAll('.priority-col')) {
    node.classList.toggle('col-off', !usesPriority);
  }
  for (const node of document.querySelectorAll('.queue-col')) {
    node.classList.toggle('col-off', !usesQueue);
  }
}

// ---------------------------------------------------------------------------
// Drawing the result
// ---------------------------------------------------------------------------

// Each time unit gets at least this many pixels, so a block of one time unit
// still shows its label. A long timeline becomes wider than its card, and the
// card then scrolls sideways.
const UNIT_MIN_PX = 30;
// A very long timeline stops growing at this width. Its blocks shrink instead.
const CHART_MAX_PX = 12000;

function colorOf(pid, results) {
  const index = Math.max(0, results.findIndex((r) => r.pid === pid));
  if (index < COLORS.length) return COLORS[index];
  // The table holds more processes than the list holds colours. Make a colour
  // from the row number. A step of 47 degrees keeps neighbours different.
  return 'hsl(' + ((index * 47) % 360) + ', 45%, 42%)';
}

/** Write a duration in words: "1 time unit" or "3 time units". */
function units(count) {
  return count + (count === 1 ? ' time unit' : ' time units');
}

/** Describe one scheduler event in a sentence, for the list and the tooltips. */
function describeEvent(event) {
  if (event.type === 'preempt') {
    return 't = ' + event.time + ': ' + event.to + ' preempts ' + event.from + '. ' +
      event.from + ' has ' + units(event.remaining) + ' left.';
  }
  return 't = ' + event.time + ': the time quantum of ' + event.from + ' ends. ' +
    event.from + ' goes to the back of queue 1 with ' + units(event.remaining) + ' left.';
}

/**
 * Make one table row from plain values. textContent keeps each value as text,
 * so a PID that holds HTML characters cannot change the page.
 */
function tableRow(values, tag) {
  const tr = document.createElement('tr');
  for (const value of values) {
    const node = document.createElement(tag);
    node.textContent = String(value);
    tr.append(node);
  }
  return tr;
}

function showErrors(messages) {
  errorList.replaceChildren();
  for (const message of messages) {
    const li = document.createElement('li');
    li.textContent = message;
    errorList.append(li);
  }
  errorCard.hidden = messages.length === 0;
}

function drawGantt(sim) {
  const total = sim.averages.totalTime;
  const percent = (time) => (time / total) * 100;
  ganttArea.replaceChildren();

  // The markers, the blocks, and the axis share one box, so they stay aligned.
  // The box is never narrower than UNIT_MIN_PX for each time unit.
  const scroller = document.createElement('div');
  scroller.className = 'gantt-scroll';
  const inner = document.createElement('div');
  inner.className = 'gantt-inner';
  inner.style.minWidth = Math.min(total * UNIT_MIN_PX, CHART_MAX_PX) + 'px';
  scroller.append(inner);
  ganttArea.append(scroller);

  // Row of markers above the chart: one for each preemption (red) and one
  // for each end of a time quantum (amber). The event list below the chart
  // gives the details, so two markers that are near do not hide their text.
  const marks = document.createElement('div');
  marks.className = 'marks';
  for (const event of sim.events) {
    const mark = document.createElement('div');
    mark.className = 'mark' + (event.type === 'quantum' ? ' quantum' : '');
    mark.style.left = percent(event.time) + '%';
    mark.textContent = '▼';
    mark.title = describeEvent(event);
    marks.append(mark);
  }
  inner.append(marks);

  // The blocks. Each block grows with the number of time units it covers.
  const chart = document.createElement('div');
  chart.className = 'gantt';
  for (const block of sim.blocks) {
    const node = document.createElement('div');
    node.className = 'blk' + (block.label === IDLE ? ' idle' : '') + (block.preempted ? ' cut' : '');
    node.style.flex = String(block.end - block.start);
    if (block.label !== IDLE) node.style.background = colorOf(block.label, sim.results);
    node.textContent = block.label;
    node.title = block.label + ': ' + block.start + ' to ' + block.end;
    chart.append(node);
  }
  inner.append(chart);

  // The time axis. Every block boundary gets a label. A label is left out
  // only when it would lie on top of the label before it. That occurs only
  // on a timeline that reached CHART_MAX_PX.
  const axis = document.createElement('div');
  axis.className = 'axis';
  const pixelsPerUnit = chart.getBoundingClientRect().width / total;
  const times = [0, ...sim.blocks.map((b) => b.end)];
  let lastLabelEnd = -Infinity; // the right edge of the last label, in pixels
  for (const time of times) {
    const center = time * pixelsPerUnit;
    const halfWidth = (String(time).length * 7 + 6) / 2; // about 7 px a digit
    if (center - halfWidth < lastLabelEnd) continue;
    lastLabelEnd = center + halfWidth;

    const tick = document.createElement('span');
    tick.style.left = percent(time) + '%';
    tick.textContent = String(time);
    axis.append(tick);
  }
  inner.append(axis);

  // The legend, with one entry for each process.
  const legend = document.createElement('div');
  legend.className = 'legend';
  for (const r of sim.results) {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.className = 'swatch';
    swatch.style.background = colorOf(r.pid, sim.results);
    item.append(swatch, r.pid);
    legend.append(item);
  }
  const idleItem = document.createElement('span');
  idleItem.innerHTML = '<i class="swatch idle"></i>CPU idle';
  legend.append(idleItem);
  const cutItem = document.createElement('span');
  cutItem.className = 'key-preempt';
  cutItem.textContent = '▼ preemption point';
  legend.append(cutItem);
  if (sim.algorithm === 'mlq') {
    const quantumItem = document.createElement('span');
    quantumItem.className = 'key-quantum';
    quantumItem.textContent = '▼ time quantum ends';
    legend.append(quantumItem);
  }
  ganttArea.append(legend);

  // The event list: every preemption and every end of a time quantum, in
  // time order. It shows why each process switch in the chart occurs.
  const logTitle = document.createElement('h3');
  logTitle.className = 'log-title';
  logTitle.textContent = 'Scheduler events';
  ganttArea.append(logTitle);

  if (sim.events.length === 0) {
    const none = document.createElement('p');
    none.className = 'placeholder';
    none.textContent = 'No preemption occurs in this run.';
    ganttArea.append(none);
    return;
  }
  const log = document.createElement('ul');
  log.className = 'event-log';
  for (const event of sim.events) {
    const li = document.createElement('li');
    li.className = event.type;
    li.textContent = describeEvent(event);
    log.append(li);
  }
  ganttArea.append(log);
}

function drawMetrics(sim) {
  const a = sim.averages;
  const usesQueue = sim.algorithm === 'mlq';
  metricsArea.replaceChildren();

  const info = document.createElement('p');
  info.className = 'run-info';
  info.textContent = 'Algorithm: ' + sim.algorithmName +
    (usesQueue ? '  |  Time quantum: ' + sim.quantum : '') +
    '  |  ' + sim.results.length + ' processes  |  ' +
    sim.events.filter((e) => e.type === 'preempt').length + ' preemptions';
  metricsArea.append(info);

  const tiles = document.createElement('div');
  tiles.className = 'tiles';
  const values = [
    ['Average Turnaround Time', a.avgTurnaround.toFixed(2)],
    ['Average Waiting Time', a.avgWaiting.toFixed(2)],
    ['CPU Utilization', a.cpuUtilization.toFixed(2) + '%'],
  ];
  for (const [title, value] of values) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = '<div>' + title + '</div><strong>' + value + '</strong>';
    tiles.append(tile);
  }
  metricsArea.append(tiles);

  const table = document.createElement('table');
  const head = document.createElement('thead');
  head.append(tableRow([
    'PID', 'Arrival', 'Burst', usesQueue ? 'Queue' : 'Priority',
    'Completion', 'Turnaround (TAT)', 'Waiting (WT)',
  ], 'th'));
  table.append(head);

  const body = document.createElement('tbody');
  for (const r of sim.results) {
    body.append(tableRow([
      r.pid, r.arrival, r.burst, usesQueue ? r.queue : r.priority,
      r.completion, r.turnaround, r.waiting,
    ], 'td'));
  }
  table.append(body);

  const foot = document.createElement('tfoot');
  foot.innerHTML = '<tr><td colspan="4">Average</td><td></td><td>' +
    a.avgTurnaround.toFixed(2) + '</td><td>' + a.avgWaiting.toFixed(2) + '</td></tr>';
  table.append(foot);
  metricsArea.append(table);

  const formula = document.createElement('p');
  formula.className = 'formula';
  formula.textContent = 'TAT = Completion − Arrival  ·  WT = TAT − Burst  ·  ' +
    'CPU Utilization = busy time ÷ total time (' + a.busyTime + ' ÷ ' + a.totalTime + ')';
  metricsArea.append(formula);
}

function clearOutput(message) {
  ganttArea.innerHTML = '<p class="placeholder">' + message + '</p>';
  metricsArea.innerHTML = '<p class="placeholder">The results table appears here after a run.</p>';
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

function runAndDraw() {
  const output = runSimulation(readRows(), {
    algorithm: algorithmBox.value,
    quantum: quantumBox.value,
  });

  if (!output.ok) {
    showErrors(output.errors);
    clearOutput('Correct the input errors, then run the simulation again.');
    return;
  }
  showErrors([]);
  drawGantt(output.simulation);
  drawMetrics(output.simulation);
}

el('run').addEventListener('click', runAndDraw);

el('reset').addEventListener('click', () => {
  setRows([{}]);
  showErrors([]);
  clearOutput('Push Run Simulation to draw the timeline.');
});

el('add-row').addEventListener('click', () => addRow());
el('load-sample').addEventListener('click', () => {
  setRows(SAMPLES[algorithmBox.value]);
  showErrors([]);
});

algorithmBox.addEventListener('change', applyColumnState);

el('upload').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const processes = parseProcessFile(String(reader.result));
    if (processes.length === 0) {
      showErrors(['The file holds no process data.']);
      return;
    }
    setRows(processes);
    showErrors([]);
  };
  reader.onerror = () => showErrors(['The file could not be read.']);
  reader.readAsText(file);
  event.target.value = ''; // let the user upload the same file again
});

// The page can open on a chosen algorithm, for example
// index.html?algorithm=mlq&quantum=2. Without the parameters it opens on the
// preemptive priority sample.
const params = new URLSearchParams(window.location.search);
if (SAMPLES[params.get('algorithm')]) algorithmBox.value = params.get('algorithm');
if (params.get('quantum')) quantumBox.value = params.get('quantum');

// Start with the sample data and its result, so the page is never empty.
setRows(SAMPLES[algorithmBox.value]);
runAndDraw();
