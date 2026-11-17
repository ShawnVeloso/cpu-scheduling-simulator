# PROJECT-BRIEF.md

Distilled from `docs/reference/OS Final Project Mechanics.pdf` (CS 3104N Operating Systems —
Final Term Project, University of San Carlos). **Read this instead of the PDF.** If the two
ever disagree, the PDF wins and this file must be corrected.

---

## 1. Project

**CPU Scheduling Simulator** — demonstrate how the short-term CPU scheduler picks processes
from the ready queue and allocates the CPU to maximize utilization and minimize waiting time.

**Group 12:** Veloso, Shawn · Martinez, Rev (2 members).

## 2. Algorithm quota (2-member group)

- At least **3** algorithms.
- At least **1 preemptive** and **1 non-preemptive**.

Permitted: FCFS, SJF (non-preemptive), SRTF (preemptive SJF), Priority (preemptive and
non-preemptive), Round Robin, Multilevel Queue (MLQ), Multilevel Feedback Queue (MLFQ).

Our choice: see `docs/DECISIONS.md` D1.

## 3. Functional requirements

| Area | Requirement |
| :--- | :--- |
| Input | Dynamic entry **or** file upload of Process ID, Arrival Time, CPU Burst Time |
| Input | Algorithm-specific inputs: priority levels, time quantum (RR/MLFQ) |
| Gantt chart | Clear, color-coded execution timeline |
| Gantt chart | Must show **process switches, idle time, and preemption points** |
| Metrics | Per-process table + system averages |
| Metrics | **TAT = Completion − Arrival** · **WT = TAT − Burst** |
| Stack | Any language; browser GUI, windowed GUI, or terminal ASCII all allowed |
| AI use | Allowed for scaffolding and UI, but **every member must defend the scheduling core line by line** |

## 4. Defense (final presentation)

- Live demo on the instructor's **predefined dataset with edge cases** (non-zero arrival
  times, gaps / idle CPU).
- Justify the algorithmic implementation.
- Each member individually explains code logic and data structures.
- Expect questions on **tie-breaking rules, queue updates, context switches**, dispatching,
  and preemption.

## 5. Rubric (100)

| Criterion | Pts | What earns it |
| :--- | ---: | :--- |
| Algorithmic Correctness | 35 | Correct tie-breaking, queue updates, preemptive context switches; exact WT, TAT, averages |
| GUI & Visualization | 25 | Responsive UI; Gantt accurately maps time slices, preemption, idle intervals |
| Code Defense & Mastery | 25 | Live demo + individual oral defense of dispatching and preemption |
| System Robustness | 15 | Meets quota; no critical errors; handles invalid input and edge cases |

## 6. Progress reports (4 in total)

Source: `docs/reference/Progress Report No. 1.pdf` and
`docs/reference/progress-report-1-instructions.png`. One member submits a **PDF** on Canvas.

**Progress Report No. 1: Foundation & Design.** No working code required. Needs a clear plan,
a **finalized tech stack**, and a **UI wireframe**. Template sections:

1. Group Information: group number, members
2. Project Specifications: chosen algorithms, technology stack
3. Task Delegation: who does what
4. Accomplishments & Wireframe: current progress, plus a wireframe image (embedded or attached)

The wireframe must clearly place the **input table** (PID, Arrival, Burst), the **performance
metrics** (WT, TAT, averages), and the **Gantt chart**.

## 7. Schedule

| Date | Item |
| :--- | :--- |
| 2026-10-30 23:59 | Progress Report No. 1 due (template on Canvas) |
| 2026-11-03 | Progress Report No. 2 due (template to be posted) |
| 2026-11-05 | Face-to-face session |
| 2026-11-17 | Class session is work time for the simulator |
| 2026-11-19 | Pre-Final Exam, room LB447TC, Chapters 7, 8, and 9 (not part of the project) |
| TBD | Progress Report No. 4 (no date or template in the repository yet) |
| TBD | Final presentation / defense |

Source for dates: `docs/reference/announcement-2026-10-26.png` and
`docs/reference/announcement-2026-11-17.png` (instructor: Doriz Roa).
Consultations: during scheduled class time, Tuesday and Thursday.
