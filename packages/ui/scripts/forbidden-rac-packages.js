/**
 * RAC interim stack from architecture.md Appendix A, plus the scoped packages
 * those entries pull in (`@react-aria/*`, `@react-stately/*`).
 *
 * One owner, imported by `entries.ts` (package-check) and
 * `elmera/no-rac-outside-quarantine` (lint). A hand-copied array in either
 * consumer is a divergence.
 *
 * @type {readonly string[]}
 */
export const FORBIDDEN_RAC_PACKAGES = Object.freeze([
  "react-aria-components",
  "react-aria",
  "@internationalized/date",
  "@react-aria",
  "@react-stately",
]);

/**
 * @param {string} specifier
 * @returns {boolean}
 */
export function isForbiddenRacSpecifier(specifier) {
  for (const name of FORBIDDEN_RAC_PACKAGES) {
    if (specifier === name || specifier.startsWith(`${name}/`)) {
      return true;
    }
  }
  return false;
}
