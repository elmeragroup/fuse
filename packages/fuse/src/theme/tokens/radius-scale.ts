/**
 * The radius rungs `fuse.css` derives from the theme's `--radius` and `--radius-step` in its
 * `@theme` block, such as `--radius-md: calc(var(--radius) - var(--radius-step))`. The CSS
 * keeps the arithmetic. Themes set only `--radius`, and the variant sets `--radius-step`.
 * The resolved theme catalog reads the step counts here to compute each rung in px for
 * tooling without `calc()`, and `radius-scale-css.test.ts` requires `fuse.css` to declare
 * exactly these CSS values.
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
 * The CSS a rung `steps` lengths from `--radius` declares, written the way `fuse.css` writes
 * it: no `calc()` at zero, and no count for a single step.
 */
function rungCss(steps: number): string {
  if (steps === 0) {
    return "var(--radius)";
  }
  const count = Math.abs(steps);
  const stepLength = count === 1 ? "var(--radius-step)" : `${String(count)} * var(--radius-step)`;
  return `calc(var(--radius) ${steps < 0 ? "-" : "+"} ${stepLength})`;
}

/** A rung `steps` lengths from `--radius`, with the CSS value built from that count. */
function rung(steps: number): RadiusRung {
  return { steps, css: rungCss(steps) };
}

/**
 * Each rung's step count and CSS value. The CSS is built from the count, so the arithmetic
 * and the declared value cannot disagree. External themes step 2px, and the internal variant
 * steps 0px, so every internal rung equals `--radius`.
 */
export const RADIUS_RUNGS = {
  "radius-xs": rung(-3),
  "radius-sm": rung(-2),
  "radius-md": rung(-1),
  "radius-lg": rung(0),
  "radius-xl": rung(2),
  "radius-popover": rung(-4),
} as const satisfies Record<RadiusRungName, RadiusRung>;
