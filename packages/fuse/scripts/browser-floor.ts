import { Features, browserslistToTargets } from "lightningcss";

/**
 * The oldest browser versions Fuse supports, Tailwind v4's floor. The shipped CSS must keep
 * working in each.
 */
export const BROWSER_FLOOR = { chrome: "111", safari: "16.4", firefox: "128" } as const;

/**
 * The browser floor as Lightning CSS targets, the same ones Tailwind's `--optimize` pass uses. iOS
 * Safari takes the Safari version, as it does in Tailwind's list.
 */
export const BROWSER_FLOOR_TARGETS = browserslistToTargets([
  `chrome ${BROWSER_FLOOR.chrome}`,
  `safari ${BROWSER_FLOOR.safari}`,
  `ios_saf ${BROWSER_FLOOR.safari}`,
  `firefox ${BROWSER_FLOOR.firefox}`,
]);

/**
 * The lowerings Tailwind's `--optimize` pass leaves out, so a sheet compiled at
 * `BROWSER_FLOOR_TARGETS` keeps logical properties, `:dir()` and `light-dark()` as written, as
 * `styles.css` does, and the browser-floor gate still sees them.
 */
export const BROWSER_FLOOR_EXCLUDE = Features.LogicalProperties | Features.DirSelector | Features.LightDark;
