# CLAUDE.md

Operational entry point for Claude Code in the **CPU Scheduling Simulator** (CS 3104N OS final
project, Group 12). This file is a fast index, **not a source of authority**. When it disagrees
with the documents below, the documents win.

---

## 1. Authority Order

1. `docs/reference/OS Final Project Mechanics.pdf`: the assignment (**do not read it**; use the brief)
2. `docs/PROJECT-BRIEF.md`: distilled requirements, rubric, deadlines
3. `docs/DECISIONS.md`: algorithm choice, stack, tie-breaking rules
4. Existing code

If code contradicts a decision in `docs/DECISIONS.md`, surface the mismatch. Do not silently
keep the code.

## 2. Token Discipline

- Read `docs/PROJECT-BRIEF.md`, not the PDFs or screenshots in `docs/reference/`. Reread a
  source only if the brief looks wrong, then fix the brief. When a new template or announcement
  is added there, distill it into the brief once.
- Read only the files a task needs. Use Grep/Glob before opening whole files.
- Record a decision once in `docs/DECISIONS.md` and refer to it after that. Do not repeat it in
  chat or in other docs.
- Memory holds people, deadlines, and preferences. The repo holds requirements and decisions.

## 3. Core Invariants: Never Violate

- **Metrics:** TAT = Completion − Arrival; WT = TAT − Burst. Averages are over all processes.
- **Gantt:** every time unit from 0 to the last completion is covered by exactly one block, a
  process or **IDLE**. Preemption points and process switches must be visible.
- **Tie-breaking** follows `docs/DECISIONS.md` D3 exactly and the same way in every algorithm.
  Never improvise a tie rule inside an algorithm.
- **Scheduling core is pure:** input is a process list plus parameters; output is a timeline plus
  per-process results. No UI, I/O, or randomness inside it, so it can be tested and defended on
  its own.
- **Defensible code:** both members must explain every line orally. Prefer plain loops and
  explicit queues over clever abstractions. Comments explain *why* a scheduling step happens
  (dispatch, preempt, enqueue order), never narrate syntax.
- **Robustness:** reject invalid input (negative or non-integer times, burst ≤ 0, duplicate PID,
  missing quantum) with a clear message. Never crash.

## 4. Repository Layout

```text
CLAUDE.md                  this index
docs/PROJECT-BRIEF.md      requirements, rubric, schedule
docs/DECISIONS.md          team decisions incl. tie-breaking
docs/progress-reports/     report drafts (.md) + wireframe/ (HTML source → PNG)
docs/reference/            original PDF + instructor announcements (do not edit)
```

Stack: vanilla HTML/CSS/JS (`docs/DECISIONS.md` D2). Source, test, and sample-dataset folders
are added when coding starts.

Re-render the wireframe PNG with headless Chrome:
`chrome.exe --headless=new --force-device-scale-factor=2 --window-size=1280,640 --screenshot=<abs path>\wireframe.png <file:// url to wireframe.html>`

## 5. Working Rules

- **Ask, do not invent**, when tie-breaking, priority direction, or quantum semantics are
  undefined. These are graded.
- Every algorithm gets tests on: simultaneous arrivals, non-zero first arrival, idle gaps, equal
  keys, and a single process.
- Verify computed WT/TAT by hand on at least one case per algorithm before calling it done.
- **Writing style: ASD-STE100 Simplified Technical English** for every report, doc, UI text,
  and code comment. Active voice, one topic per sentence, ≤20 words for instructions and ≤25
  for descriptions, simple tenses, verbs instead of noun stacks, one term per concept. No
  filler or hype words.
- Progress reports live in `docs/progress-reports/` as one `.html` file each, ready to copy
  into Google Docs. Do not keep a second copy of the same report in another format.
- State plainly what was and was not tested.
- Commit or push only when asked.
