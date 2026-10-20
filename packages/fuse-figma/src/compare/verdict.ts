/**
 * What one cell's comparison means: the box size difference, the mismatch as a share of the box,
 * and flags for what needs a look. The report sorts the worst cells first: a cell whose box size
 * differs or that could not be compared, then by tolerant mismatch, then by raw mismatch.
 */

import type { PixelSize } from "./align.ts";

/** A box size in CSS pixels, which equal Figma canvas pixels. */
export type BoxSize = { readonly width: number; readonly height: number };

/**
 * Something about a cell that needs a look.
 *
 * - `size`: the boxes differ by half a pixel or more on a side.
 * - `subpixel-size`: the boxes differ by less than half a pixel, more than layout rounding.
 * - `png-size`: the Figma PNG is not the size its render bounds promise, so its placement is a
 *   guess.
 * - `state-by-interaction`: forcing the pseudo class changed none of the button's styles, so the
 *   page hovered or focused the button for real.
 * - `state-missing`: the browser did not show the state at all, so the browser side is wrong.
 * - `no-figma-image`: Figma drew nothing for the instance.
 */
export type CellFlag =
  | "size"
  | "subpixel-size"
  | "png-size"
  | "state-by-interaction"
  | "state-missing"
  | "no-figma-image";

/** The flags that put a cell at the top of the report whatever its pixels say. */
const SEVERE: readonly CellFlag[] = ["no-figma-image", "state-missing", "size"];

/** A box side may differ by this much before it counts as a size difference. */
const SIZE_TOLERANCE = 0.5;

/** Chromium lays out in 1/64 px, so a smaller difference is rounding. */
const LAYOUT_ROUNDING = 1 / 64;

/** The comparison of one cell. */
export type CellVerdict = {
  /** Figma's box width minus the browser's, in CSS pixels. */
  readonly widthDelta: number;
  /** Figma's box height minus the browser's, in CSS pixels. */
  readonly heightDelta: number;
  /** Raw mismatched pixels as a percentage of the browser box's area in device pixels. */
  readonly rawPercent: number;
  /** Tolerant mismatched pixels as a percentage of the same area. */
  readonly tolerantPercent: number;
  readonly flags: readonly CellFlag[];
};

/** What the comparison of one cell measured. */
export type CellMeasurement = {
  readonly figmaBox: BoxSize;
  readonly browserBox: BoxSize;
  /** The mismatch counts, or undefined when there was nothing to diff. */
  readonly mismatch: { readonly raw: number; readonly tolerant: number } | undefined;
  readonly scale: number;
  /** Flags the caller already knows, such as how the state was reached. */
  readonly flags: readonly CellFlag[];
};

/**
 * Judge one cell.
 *
 * @param measurement - The boxes, the mismatch counts and the flags found while rendering.
 * @returns The size deltas, the mismatch percentages and every flag.
 */
export function judgeCell(measurement: CellMeasurement): CellVerdict {
  const { figmaBox, browserBox, mismatch, scale } = measurement;
  const widthDelta = figmaBox.width - browserBox.width;
  const heightDelta = figmaBox.height - browserBox.height;
  const largest = Math.max(Math.abs(widthDelta), Math.abs(heightDelta));
  const sizeFlags: CellFlag[] =
    largest >= SIZE_TOLERANCE ? ["size"] : largest > LAYOUT_ROUNDING ? ["subpixel-size"] : [];
  const area: PixelSize = {
    width: Math.max(1, Math.round(browserBox.width * scale)),
    height: Math.max(1, Math.round(browserBox.height * scale)),
  };
  const percent = (pixels: number) => (pixels / (area.width * area.height)) * 100;
  return {
    widthDelta,
    heightDelta,
    rawPercent: mismatch === undefined ? 0 : percent(mismatch.raw),
    tolerantPercent: mismatch === undefined ? 0 : percent(mismatch.tolerant),
    flags: [
      ...sizeFlags,
      ...measurement.flags,
      ...(mismatch === undefined ? ["no-figma-image" as const] : []),
    ],
  };
}

/**
 * Order cells worst first: a severe flag first, then the tolerant mismatch, then the raw one.
 * Cells that tie keep their order.
 *
 * @template Row - A report row that carries a verdict.
 * @param rows - The rows.
 * @returns A sorted copy.
 */
export function worstFirst<Row extends { readonly verdict: CellVerdict }>(rows: readonly Row[]): Row[] {
  const severe = (row: Row) => (row.verdict.flags.some((flag) => SEVERE.includes(flag)) ? 0 : 1);
  return rows.toSorted(
    (left, right) =>
      severe(left) - severe(right) ||
      right.verdict.tolerantPercent - left.verdict.tolerantPercent ||
      right.verdict.rawPercent - left.verdict.rawPercent
  );
}
