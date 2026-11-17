// pid-order.js - the one meaning of "lower PID" (docs/DECISIONS.md D3, rule 2).
//
// A plain text comparison puts "P10" before "P2", because it compares the
// characters "1" and "2" and stops there. The lower PID must be the lower
// process number, so this module compares the digits as a number.
//
// Every algorithm uses this function. The PID order is then the same in all
// of them.

/**
 * Compare two PIDs.
 * @returns a negative number when `a` is the lower PID, a positive number
 *          when `b` is the lower PID, and 0 when the two are equal in order.
 */
export function comparePid(a, b) {
  // `numeric: true` reads a run of digits as one number: 2 is before 10.
  // The fixed locale 'en' gives the same order on every computer.
  return a.localeCompare(b, 'en', { numeric: true });
}
