/**
 * The radius steps `fuse.css` derives from the theme's `--radius` in its `@theme` block,
 * such as `--radius-md: calc(var(--radius) - 2px)`. The CSS keeps the arithmetic, so a theme
 * sets only `--radius`. Tooling without `calc()`, such as the Figma sync, reads the offsets
 * here, and `radius-scale-css.test.ts` requires `fuse.css` to declare the same ones.
 */

/** The derived radius custom properties, without their leading dashes, in `fuse.css` order. */
export const RADIUS_STEP_NAMES = [
  "radius-xs",
  "radius-sm",
  "radius-md",
  "radius-lg",
  "radius-xl",
  "radius-popover",
] as const;

/** One derived radius step, such as `radius-md`. */
export type RadiusStepName = (typeof RADIUS_STEP_NAMES)[number];

/**
 * How many pixels each step adds to `--radius`. A negative offset can take a step below
 * zero for a small theme radius, and CSS then clamps the `border-radius` that uses it to 0.
 */
export const RADIUS_STEP_OFFSETS = {
  "radius-xs": -6,
  "radius-sm": -4,
  "radius-md": -2,
  "radius-lg": 0,
  "radius-xl": 4,
  "radius-popover": -8,
} as const satisfies Record<RadiusStepName, number>;
