/**
 * A bar's drawn rectangle in plot pixels, which the bar layout's unit suites share.
 */
import { barGeometry, geometryRect } from "../../src/components/chart/layout/bar-geometry";
import type { BarCell } from "../../src/components/chart/layout/bar-geometry";
import type { BarMetrics, PlotFrame, PlotRect, SubBand } from "../../src/components/chart/layout/plot-frame";

/**
 * The rectangle a bar cell draws.
 *
 * @param frame - The plot frame.
 * @param cell - The bar's cell.
 * @param metrics - The bar metrics.
 * @param sub - The sub-band the bar draws in.
 * @param seam - Whether a stacked bar's seam cuts its body or the bar draws whole.
 * @returns The rectangle in plot pixels.
 */
export function barRect(
  frame: PlotFrame,
  cell: BarCell,
  metrics: BarMetrics,
  sub: SubBand,
  seam: "cut" | "whole"
): PlotRect {
  return geometryRect(frame, barGeometry(frame, cell, metrics, sub, seam), cell.place);
}
