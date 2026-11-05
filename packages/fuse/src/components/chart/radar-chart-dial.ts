"use client";

/**
 * What the radar's AngleAxis and RadiusAxis share: where a spoke label sits past the rim, and the
 * widths each spoke label shows at, made once per drawing so the RadiusAxis clears the labels the
 * AngleAxis shows. Labels are HTML in the cell (S12), placed in percentages of the sweep's box, so
 * the server's markup holds at any width. Each part keeps its own module, so a route ships only the
 * parts it names (Q1).
 */
import type { RadarDrawing } from "./chart-polar-context";
import { fitStridedLabels } from "./layout/clock-labels";
import { labelWidth } from "./layout/label-width";
import type { SweepBox } from "./layout/polar-angle";
import { spokeAngle } from "./layout/radar";

/** How far past the rim a spoke label's point sits, as a share of the radius. */
export const LABEL_REACH = 1.1;

/** Each radar's spoke labels as the angle axis thins them, made once per drawing. */
const spokeFits = new WeakMap<RadarDrawing, readonly (number | "always" | "none")[]>();

/**
 * The narrowest container width each spoke label shows at. The labels thin by a stride that divides
 * the spoke count, so the labels that show stay evenly spaced round the dial, and the first spoke's
 * label always shows.
 */
export function spokeLabelFit(radar: RadarDrawing): readonly (number | "always" | "none")[] {
  const known = spokeFits.get(radar);
  if (known !== undefined) return known;
  const strides = Array.from({ length: radar.count }, (_, index) => index + 1).filter(
    (stride) => radar.count % stride === 0
  );
  const fit = fitStridedLabels(
    radar.labels.map((_, index) => ({ angle: spokeAngle(index, radar.count), unit: index })),
    radar.labels.map((label) => labelWidth(label.text)),
    strides,
    LABEL_REACH
  );
  spokeFits.set(radar, fit);
  return fit;
}

/** A point's place in the cell, as percentages of the sweep's box. */
export function percent(box: SweepBox, x: number, y: number): readonly [string, string] {
  const left = ((x - box.left) / (box.right - box.left)) * 100;
  const top = ((y - box.top) / (box.bottom - box.top)) * 100;
  return [`${left.toFixed(3)}%`, `${top.toFixed(3)}%`];
}
