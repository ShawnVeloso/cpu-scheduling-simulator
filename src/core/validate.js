// validate.js - input checks for the scheduling core.
//
// The core must never crash on bad input. This module turns a raw table of
// rows into either a clean process list or a list of messages for the user.
// It has no DOM access, so the CLI and the browser use the same checks.

import { IDLE } from './timeline.js';

const ALGORITHMS = ['priority-np', 'priority-p', 'mlq'];

// The core runs the CPU one time unit at a time. A very large time value
// makes the loop run too long and stops the page, so the input has a limit.
export const MAX_TIME = 100000;

// A field must be a whole number. The GUI gives strings, so accept both.
function toInteger(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : null;
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^-?\d+$/.test(text)) return null;
  return Number.parseInt(text, 10);
}

/**
 * Check one table of processes and one set of parameters.
 * @returns {{ok: boolean, errors: string[], processes: object[], options: object}}
 */
export function validateInput(rows, options = {}) {
  const errors = [];
  const algorithm = options.algorithm;

  if (!ALGORITHMS.includes(algorithm)) {
    errors.push(`Unknown algorithm "${algorithm}".`);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    errors.push('Add at least one process.');
    return { ok: false, errors, processes: [], options: {} };
  }

  const processes = [];
  const seenPids = new Set();

  rows.forEach((rawRow, index) => {
    const row = rawRow ?? {}; // a missing row must give messages, not a crash
    const line = `Row ${index + 1}`;
    const pid = String(row.pid ?? '').trim();

    if (pid === '') {
      errors.push(`${line}: the Process ID is empty.`);
    } else if (pid.toUpperCase() === IDLE) {
      // The timeline uses this label for the idle CPU. A process with the
      // same name would count as idle time and make the utilization wrong.
      errors.push(`${line}: the Process ID "${pid}" is reserved for the idle CPU.`);
    } else if (seenPids.has(pid)) {
      errors.push(`${line}: the Process ID "${pid}" is a duplicate.`);
    } else {
      seenPids.add(pid);
    }

    const arrival = toInteger(row.arrival);
    if (arrival === null) {
      errors.push(`${line}: the arrival time must be a whole number.`);
    } else if (arrival < 0) {
      errors.push(`${line}: the arrival time must be 0 or more.`);
    } else if (arrival > MAX_TIME) {
      errors.push(`${line}: the arrival time must be ${MAX_TIME} or less.`);
    }

    const burst = toInteger(row.burst);
    if (burst === null) {
      errors.push(`${line}: the burst time must be a whole number.`);
    } else if (burst <= 0) {
      errors.push(`${line}: the burst time must be more than 0.`);
    } else if (burst > MAX_TIME) {
      errors.push(`${line}: the burst time must be ${MAX_TIME} or less.`);
    }

    // Both priority algorithms need a priority. MLQ ignores it.
    let priority = toInteger(row.priority);
    if (algorithm === 'priority-np' || algorithm === 'priority-p') {
      if (priority === null) {
        errors.push(`${line}: the priority must be a whole number.`);
      } else if (priority < 1) {
        errors.push(`${line}: the priority must be 1 or more. A lower number is a higher priority.`);
      }
    } else if (priority === null) {
      priority = 0;
    }

    // Only MLQ uses the queue column.
    let queue = toInteger(row.queue);
    if (algorithm === 'mlq') {
      if (queue === null) {
        errors.push(`${line}: the queue must be 1 or 2.`);
      } else if (queue !== 1 && queue !== 2) {
        errors.push(`${line}: the queue must be 1 (foreground) or 2 (background).`);
      }
    } else if (queue === null) {
      queue = 1;
    }

    processes.push({ pid, arrival, burst, priority, queue });
  });

  // Round Robin in queue 1 of the MLQ needs a time quantum.
  let quantum = null;
  if (algorithm === 'mlq') {
    quantum = toInteger(options.quantum);
    if (quantum === null) {
      errors.push('The Multilevel Queue needs a time quantum.');
    } else if (quantum <= 0) {
      errors.push('The time quantum must be more than 0.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, processes: [], options: {} };
  }
  return { ok: true, errors: [], processes, options: { algorithm, quantum } };
}
