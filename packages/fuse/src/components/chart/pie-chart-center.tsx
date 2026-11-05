"use client";

/**
 * The text in a pie's or radial chart's hole (CONTRACT section 8.13). The Center lays its parts in
 * the square inscribed in the hole, and a CenterLabel is a text line among them. The numbers are
 * parts of their own, in `pie-chart-center-value`, so a route that names none ships no digit roll
 * (Q1). The Center is plot output, hidden from readers, who read the same numbers from the options.
 */
import type { ReactElement, ReactNode } from "react";

import { pieDrawingOf, radialDrawingOf, usePolarContext } from "./chart-polar-context";
import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `PieChart.Center`, a closed part.
 *
 * @beta
 */
export type PieChartCenterProps = ChartLayerProps & {
  /** The centre's content, such as `CenterValue` over a `CenterLabel`. */
  children?: ReactNode;
};

/**
 * Props for `PieChart.CenterLabel`, a closed part.
 *
 * @beta
 */
export type PieChartCenterLabelProps = ChartLayerProps & {
  /** The label text, such as "av" between the value and the maximum. */
  children?: ReactNode;
};

/**
 * The text in the hole of a donut or a gauge: its parts sit in the square inscribed in the hole,
 * centred on the dial and kept to the sweep's box, so a semicircle's sits above its flat edge. Every part prints the active slice, or with nothing active the pie's own
 * number.
 *
 * @beta
 */
export function PieChartCenter({ children, className, style }: PieChartCenterProps): ReactElement {
  const { model, box } = usePolarContext("PieChart.Center", ["pie", "radial"]);
  const hole = pieDrawingOf(model)?.innerRadius ?? radialDrawingOf(model)?.innerRadius;
  if (hole === undefined) return <></>;
  // A pie with no hole lays its centre in the square inscribed in half the radius. The square
  // keeps to the sweep's box, so a semicircle's centre sits above its flat edge.
  const half = (Math.SQRT2 * (hole > 0 ? hole : 0.5)) / 2;
  const left = Math.max(-half, box.left);
  const right = Math.min(half, box.right);
  const top = Math.max(-half, box.top);
  const bottom = Math.min(half, box.bottom);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const percent = (value: number, of: number): string => `${((value / of) * 100).toFixed(3)}%`;
  return (
    <div
      data-slot="pie-chart-center"
      data-polar-layer=""
      aria-hidden="true"
      className={className}
      style={style}>
      <div
        data-part="hole"
        style={{
          "--_left": percent(left - box.left, width),
          "--_top": percent(top - box.top, height),
          "--_width": percent(right - left, width),
          "--_height": percent(bottom - top, height),
        }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A text line in the centre, such as the word between the value and the maximum.
 *
 * @beta
 */
export function PieChartCenterLabel({ children, className, style }: PieChartCenterLabelProps): ReactElement {
  usePolarContext("PieChart.CenterLabel", ["pie", "radial"]);
  return (
    <span data-slot="pie-chart-center-label" className={className} style={style}>
      {children}
    </span>
  );
}

Object.assign(PieChartCenter, { displayName: "PieChart.Center" });
Object.assign(PieChartCenterLabel, { displayName: "PieChart.CenterLabel" });
