# DECISIONS.md

One entry per decision. Status: `OPEN` (needs the team), `DECIDED` (date + who), or
`SUPERSEDED` (link the replacement). Tie-breaking rules live here because they are graded
(Algorithmic Correctness, 35 pts) and asked about in the defense.

---

## D1. Algorithms — DECIDED 2026-10-29 (user delegated the choice to Claude)

1. **Priority, non-preemptive** (non-preemptive ✓)
2. **Priority, preemptive** (preemptive ✓)
3. **Multilevel Queue (MLQ)**, 2 levels, fixed-priority preemptive between queues:
   - Q1 (foreground / interactive): Round Robin, user-set time quantum
   - Q2 (background / batch): FCFS
   - Each process is permanently assigned to Q1 or Q2 by a `Queue` input column.
   - Q2 runs only while Q1 is empty. A Q1 arrival preempts a running Q2 process at once.

Why this set:
- **Not generic.** As of 2026-10-29, 7 of 11 groups chose FCFS/SJF/RR, with or without SRTF,
  and no group chose MLQ.
- **Easy.** Algorithms 1 and 2 are one function with a `preemptive` flag: pick the
  highest-priority ready process, then either run it to completion or re-check at every
  arrival. MLQ reuses plain RR and FCFS inside its two queues, so no new selection logic is
  needed.
- **One story for the defense.** Priority grows from a single ready queue (1 and 2) to
  separate queue classes (3). One input form covers all three: PID, Arrival, Burst,
  Priority, Queue, Quantum.
- **Meets the quota with margin.** Two preemptive algorithms, one non-preemptive.

Action: fill in the Group 12 row of the class table in the project mechanics document.

## D2. Tech stack — DECIDED 2026-10-29 (user accepted Claude's recommendation)

Vanilla **HTML + CSS + JavaScript**, no frameworks and no build step. The Gantt chart is
HTML/CSS blocks, and file upload uses CSV/TXT through `FileReader`. Git is the version
control. Keep the scheduling core in its own JS file(s) with no DOM access (`CLAUDE.md` §3).

**Amendment 2026-11-08.** The core is written as ES modules, because the Node test runner
and the browser must import the same files. A browser blocks ES modules that are opened
with `file://`, so the page is served by a static server instead:

```
python -m http.server 8000     # then open http://localhost:8000/
```

This is still not a build step. Nothing is compiled or bundled. The alternative, a global
`<script>` namespace, would stop Node from importing the core and would end the automated
tests, so we kept the modules.

## D3. Tie-breaking and queue rules — DECIDED 2026-10-29 (user accepted as proposed)

Fix these before any algorithm is written, then apply them the same way everywhere and cover
them with tests. These are the standard textbook (Silberschatz) conventions:

1. **Priority direction:** a lower number means higher priority (1 beats 5).
2. **Equal priority:** earlier arrival wins, then lower PID.
3. **Preemptive Priority:** an arrival preempts only when its priority is **strictly** higher.
   An equal-priority arrival does not preempt.
4. **The preempted process** goes back into the ready set with its remaining burst. Its
   original arrival time is used for rule 2.
5. **MLQ, Q1 (RR):** when a new arrival and a quantum-expired process reach the queue at the
   same instant, **the new arrival is enqueued first**.
6. **MLQ, Q2 preempted by Q1:** the Q2 process stays at the **front** of Q2 and resumes when
   Q1 empties. Its quantum is not reset because Q2 is FCFS and has none.
7. **Idle CPU:** with nothing ready, jump to the next arrival and draw an IDLE block.
8. **Context-switch overhead:** 0.

**Clarification — DECIDED 2026-11-17 (Shawn accepted Claude's proposal).** In rule 2, "lower PID" means
the lower process number: P2 is lower than P10. The code compared the PIDs as text until
this date, which put P10 before P2. `src/core/pid-order.js` now holds the one comparison,
and both `priority.js` and `mlq.js` use it. The same order decides which of two processes
that arrive together enters an MLQ queue first.

## D4. Task delegation — DECIDED 2026-10-29

- **Shawn Veloso:** scheduling core (all three algorithms, queues, tie-breaking) and metrics.
- **Rev Martinez:** UI, input table and file upload, validation, Gantt rendering.
- **Both:** edge-case datasets, hand-checked results, reviewing each other's code for the
  defense.
