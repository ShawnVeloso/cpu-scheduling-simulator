// timeline.js - the Gantt timeline and the performance metrics.
//
// The algorithms run the CPU one time unit at a time. Each unit is recorded
// here. This module joins the units into blocks and calculates the metrics.
// Every time unit from 0 to the last completion belongs to exactly one block.

export const IDLE = 'IDLE';

/**
 * Collect one time unit at a time and join equal neighbours into one block.
 */
export class TimelineBuilder {
  constructor() {
    this.blocks = [];
  }

  /**
   * Record that `label` held the CPU for the time unit [time, time + 1).
   * The unit extends the last block when the same label ran just before it.
   */
  add(label, time) {
    const last = this.blocks[this.blocks.length - 1];
    if (last && last.label === label && last.end === time && !last.preempted) {
      last.end = time + 1;
      return;
    }
    this.blocks.push({ label, start: time, end: time + 1, preempted: false });
  }

  /**
   * Mark the block that ends now as cut short. The Gantt chart draws a
   * preemption marker at this point, so the block must not grow further.
   */
  markPreempted() {
    const last = this.blocks[this.blocks.length - 1];
    if (last) last.preempted = true;
  }

  build() {
    return this.blocks;
  }
}

/**
 * Build the per-process table and the system averages.
 * TAT = Completion - Arrival. WT = TAT - Burst. (CLAUDE.md invariant)
 */
export function buildMetrics(processes, blocks) {
  const results = processes.map((p) => {
    const turnaround = p.completion - p.arrival;
    return {
      pid: p.pid,
      arrival: p.arrival,
      burst: p.burst,
      priority: p.priority,
      queue: p.queue,
      completion: p.completion,
      turnaround,
      waiting: turnaround - p.burst,
    };
  });

  const count = results.length;
  const totalTAT = results.reduce((sum, r) => sum + r.turnaround, 0);
  const totalWT = results.reduce((sum, r) => sum + r.waiting, 0);

  const totalTime = blocks.length === 0 ? 0 : blocks[blocks.length - 1].end;
  const idleTime = blocks
    .filter((b) => b.label === IDLE)
    .reduce((sum, b) => sum + (b.end - b.start), 0);
  const busyTime = totalTime - idleTime;

  return {
    results,
    averages: {
      avgTurnaround: count === 0 ? 0 : totalTAT / count,
      avgWaiting: count === 0 ? 0 : totalWT / count,
      totalTime,
      busyTime,
      idleTime,
      cpuUtilization: totalTime === 0 ? 0 : (busyTime / totalTime) * 100,
    },
  };
}

/**
 * Check the invariant: the blocks cover every time unit once, with no gap
 * and no overlap. The tests and the GUI both call this.
 */
export function timelineIsContinuous(blocks) {
  let expected = 0;
  for (const block of blocks) {
    if (block.start !== expected) return false;
    if (block.end <= block.start) return false;
    expected = block.end;
  }
  return true;
}
