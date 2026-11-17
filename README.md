# CPU Scheduling Simulator

CS 3104N Operating Systems, Final Term Project. Group 12: Shawn Veloso, Rev Martinez.

Three algorithms: Priority (non-preemptive), Priority (preemptive), and a two-level
Multilevel Queue (Q1 = Round Robin, Q2 = FCFS).

## Run the browser simulator

The core uses ES modules, so the page needs a local web server. A browser blocks module
files that are opened directly from the disk.

```
python -m http.server 8000
```

Then open <http://localhost:8000/> in a browser.

## Run the console test of the backend

```
node tools/demo.js
```

## Run the tests

```
node tests/run-tests.js
```

## Folders

```
index.html        the simulator page
src/core/         the scheduling core (no DOM, no input/output, no randomness)
  validate.js     input checks
  pid-order.js    the one meaning of "lower PID" for tie-breaking
  timeline.js     Gantt blocks and the metrics
  priority.js     Priority Scheduling, both versions
  mlq.js          Multilevel Queue
  index.js        runSimulation(), the one entry point
src/ui/           the browser interface (app.js, styles.css)
tests/            the test suite for the core
tools/demo.js     the console proof of the backend
samples/          example input files for the upload button
docs/             the project brief, the decisions, and the progress reports
```
