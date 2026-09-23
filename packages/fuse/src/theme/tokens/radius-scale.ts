/**
 * The radius rungs `fuse.css` derives from the theme's `--radius` and `--radius-step` in its
 * `@theme` block, such as `--radius-md: calc(var(--radius) - var(--radius-step))`. The CSS
 * keeps the arithmetic, so a theme sets only `--radius` and `--radius-step`. Tooling without
 * `calc()`, such as the Figma sync, reads the step counts here, and
 * `radius-scale-css.test.ts` requires `fuse.css` to declare the same ones.
 */

/** The derived radius custom properties, without their leading dashes, in `fuse.css` order. */
export const RADIUS_RUNG_NAMES = [
  "radius-xs",
  "radius-sm",
  "radius-md",
  "radius-lg",
  "radius-xl",
  "radius-popover",
] as const;

/** One derived radius rung, such as `radius-md`. */
export type RadiusRungName = (typeof RADIUS_RUNG_NAMES)[number];

/**
 * How many `--radius-step` lengths each rung adds to `--radius`. External themes step 2px,
 * and the internal variant steps 0px, so every internal rung equals `--radius`. A negative
 * count can take a rung below zero for a small theme radius, and CSS then clamps the
 * `border-radius` that uses it to 0.
 */
export const RADIUS_RUNG_STEPS = {
  "radius-xs": -3,
  "radius-sm": -2,
  "radius-md": -1,
  "radius-lg": 0,
  "radius-xl": 2,
  "radius-popover": -4,
} as const satisfies Record<RadiusRungName, number>;
