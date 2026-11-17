// parse-file.js - read uploaded process data.
//
// Format: one process per line, "pid,arrival,burst,priority,queue".
// A semicolon or a tab also separates the fields. The parser skips empty
// lines, comment lines that start with #, and one header line.
//
// This file has no DOM access, so the tests can call it directly. It does no
// checking of the values. The core does that work.

export function parseProcessFile(text) {
  const processes = [];
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const parts = line.split(/[,;\t]+/).map((part) => part.trim());
    if (/^p(id)?$/i.test(parts[0]) || /^process/i.test(parts[0])) continue;

    processes.push({
      pid: parts[0] ?? '',
      arrival: parts[1] ?? '',
      burst: parts[2] ?? '',
      priority: parts[3] ?? '1',
      queue: parts[4] ?? '1',
    });
  }
  return processes;
}
