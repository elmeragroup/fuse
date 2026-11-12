/**
 * The names of a Sparkline's server markup and the place its hover marks rest at: what the
 * hook-free component writes and what CSS, or a client module that reads the markup back, selects
 * by and reads. The module has no directive, so the server component and a client module import
 * the same names.
 *
 * Each slot is an attribute object a part spreads, so the density lint and the theme studio read
 * the slot here as a literal `data-slot`.
 */
import type { SparklinePoint, SparklineSpan } from "./layout/sparkline-layout";

/** The `data-slot` of each Sparkline part, as the attribute a part spreads. */
export const SPARKLINE_SLOT = {
  root: { "data-slot": "sparkline" },
  path: { "data-slot": "sparkline-path" },
  bar: { "data-slot": "sparkline-bar" },
  dot: { "data-slot": "sparkline-dot" },
  reference: { "data-slot": "sparkline-reference" },
  value: { "data-slot": "sparkline-value" },
  crosshair: { "data-slot": "sparkline-crosshair" },
  glide: { "data-slot": "sparkline-glide" },
} as const;

/**
 * The `data-part` values a Sparkline's parts take: a value's hit cell, the hover dot, the
 * highlight a hover shows at full strength, an area's fill and the zero line; and, inside the
 * glide group, the marks `SparklineHover` moves and the groups that translate them.
 */
export const SPARKLINE_PART = {
  hit: "hit",
  hover: "hover",
  highlight: "highlight",
  fill: "fill",
  zero: "zero",
  glide: "glide",
  crosshair: "crosshair",
  dot: "dot",
  bandStart: "band-start",
  bandEnd: "band-end",
} as const;

/**
 * A place to mark, in percent of the box, with the band its highlight clips to, if it has one.
 * The part that marks it writes `--_value-x` and `--_value-y`, and `--_band-start` and
 * `--_band-end` with a band, which CSS places the crosshair, the dot and the highlight by.
 */
export type SparklineMarkPlace = SparklinePoint & { readonly band?: SparklineSpan };

/** A custom property written on an element's style, as a number, NaN when none is. */
function readNumber(element: SVGElement, name: string): number {
  return Number.parseFloat(element.style.getPropertyValue(name));
}

/**
 * The place a value's hover region marks, read back from the custom properties its server markup
 * wrote.
 *
 * @param region - A `sparkline-value` group.
 * @returns The place, with the band when the region wrote one.
 */
export function readPlace(region: SVGElement): SparklineMarkPlace {
  const x = readNumber(region, "--_value-x");
  const y = readNumber(region, "--_value-y");
  const start = readNumber(region, "--_band-start");
  const end = readNumber(region, "--_band-end");
  return Number.isFinite(start) && Number.isFinite(end) ? { x, y, band: [start, end] } : { x, y };
}
