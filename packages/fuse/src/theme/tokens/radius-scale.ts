/**
 * The radius rungs `fuse.css` derives from the theme's `--radius` and `--radius-step` in its
 * `@theme` block, such as `--radius-md: calc(var(--radius) - var(--radius-step))`. The CSS
 * keeps the arithmetic. Themes set only `--radius`, and the variant sets `--radius-step`.
 * Tooling without `calc()`, such as the Figma sync, reads the step counts and CSS values
 * here, and `radius-scale-css.test.ts` requires `fuse.css` to declare exactly these values.
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

/** One rung's distance from `--radius` and the value `fuse.css` declares for it. */
type RadiusRung = {
  /**
   * How many `--radius-step` lengths the rung adds to `--radius`. A negative count can take
   * a rung below zero for a small theme radius, and CSS then clamps the `border-radius` that
   * uses it to 0.
   */
  readonly steps: number;

  /** The exact value `fuse.css` declares for the rung, which is also its web code syntax. */
  readonly css: string;
};

/**
 * Each rung's step count and CSS value. External themes step 2px, and the internal variant
 * steps 0px, so every internal rung equals `--radius`.
 */
export const RADIUS_RUNGS = {
  "radius-xs": { steps: -3, css: "calc(var(--radius) - 3 * var(--radius-step))" },
  "radius-sm": { steps: -2, css: "calc(var(--radius) - 2 * var(--radius-step))" },
  "radius-md": { steps: -1, css: "calc(var(--radius) - var(--radius-step))" },
  "radius-lg": { steps: 0, css: "var(--radius)" },
  "radius-xl": { steps: 2, css: "calc(var(--radius) + 2 * var(--radius-step))" },
  "radius-popover": { steps: -4, css: "calc(var(--radius) - 4 * var(--radius-step))" },
} as const satisfies Record<RadiusRungName, RadiusRung>;
