/**
 * RAC interim dependencies, plus the scoped packages
 * those entries pull in (`@react-aria/*`, `@react-stately/*`).
 *
 * `package-check-lib.ts` reads it through `isForbiddenRacSpecifier`.
 * `elmera/no-rac-outside-quarantine` keeps its own copy of this list in
 * `@elmeragroup/internal`, so a change here must be mirrored there.
 *
 * @type {readonly string[]}
 */
const FORBIDDEN_RAC_PACKAGES = Object.freeze([
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
