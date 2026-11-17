// index.js - the one entry point into the scheduling core.
//
// The GUI and the console demo both call runSimulation(). Nothing in this
// folder touches the DOM, reads a file, or uses a random number, so the
// core is testable on its own. (CLAUDE.md section 3)

import { validateInput } from './validate.js';
import { schedulePriority } from './priority.js';
import { scheduleMLQ } from './mlq.js';

export { validateInput } from './validate.js';
export { schedulePriority } from './priority.js';
export { scheduleMLQ } from './mlq.js';
export { timelineIsContinuous, IDLE } from './timeline.js';

export const ALGORITHM_NAMES = {
  'priority-np': 'Priority Scheduling (Non-preemptive)',
  'priority-p': 'Priority Scheduling (Preemptive)',
  mlq: 'Multilevel Queue (Q1 = Round Robin, Q2 = FCFS)',
};

/**
 * Check the input, then run the selected algorithm.
 * @param {object[]} rows - raw rows from the GUI or from a file
 * @param {{algorithm: string, quantum?: number}} options
 * @returns {{ok: boolean, errors: string[], simulation: object|null}}
 */
export function runSimulation(rows, options) {
  const checked = validateInput(rows, options);
  if (!checked.ok) {
    return { ok: false, errors: checked.errors, simulation: null };
  }

  const { processes, options: clean } = checked;
  let simulation;

  switch (clean.algorithm) {
    case 'priority-np':
      simulation = schedulePriority(processes, { preemptive: false });
      break;
    case 'priority-p':
      simulation = schedulePriority(processes, { preemptive: true });
      break;
    case 'mlq':
      simulation = scheduleMLQ(processes, { quantum: clean.quantum });
      break;
    default:
      return { ok: false, errors: ['Unknown algorithm.'], simulation: null };
  }

  return {
    ok: true,
    errors: [],
    simulation: {
      algorithm: clean.algorithm,
      algorithmName: ALGORITHM_NAMES[clean.algorithm],
      quantum: clean.quantum,
      ...simulation,
    },
  };
}
