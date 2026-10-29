"use client";

import type { ReactElement } from "react";

import { useChartLayout, useChartRoot } from "./chart-context";
import type { ChartLayerProps } from "./chart-types";
import { valueTop } from "./layout/plot-geometry";

/**
 * Props for `Chart.Grid`, a closed part.
 *
 * @beta
 */
export type ChartGridProps = ChartLayerProps & {
  /**
   * Which lines to draw, in screen directions. Without it, lines at the value ticks, which are
   * horizontal under `orientation="vertical"` and vertical under `"horizontal"`.
   */
  orientation?: "horizontal" | "vertical" | "both";
  /** The line style. "solid" by default, as the Figma `Chart` component draws. */
  variant?: "solid" | "dashed";
};

/**
 * Lines at the value ticks, behind the marks. The line at 0 always draws solid, so negative values
 * hang below a visible zero line. Lines across the value axis sit between the slots.
 *
 * @beta
 */
export function ChartGrid({
  orientation,
  variant = "solid",
  className,
  style,
}: ChartGridProps): ReactElement {
  const { model, orientation: chartOrientation } = useChartRoot("Chart.Grid");
  const { y } = useChartLayout("Chart.Grid");
  const window = model.window;
  const valueLines = chartOrientation === "vertical" ? "horizontal" : "vertical";
  const drawn = orientation ?? valueLines;
  const showValues = drawn === "both" || drawn === valueLines;
  const showSlots = drawn === "both" || drawn !== valueLines;
  const count = window === null ? 0 : window.last - window.first + 1;
  return (
    <div
      data-slot="chart-grid"
      data-variant={variant}
      data-direction={drawn}
      aria-hidden="true"
      className={className}
      style={style}>
      {showValues
        ? y.ticks.map((tick) => (
            <div
              key={`value-${String(tick)}`}
              data-slot="chart-grid-line"
              data-axis="value"
              data-zero={tick === 0 ? "" : undefined}
              style={{ "--chart-at": `${String(valueTop(y.domain, tick))}%` }}
            />
          ))
        : null}
      {showSlots
        ? Array.from({ length: Math.max(0, count - 1) }, (_, index) => (
            <div
              key={`slot-${String(index)}`}
              data-slot="chart-grid-line"
              data-axis="slot"
              style={{ "--chart-at": `${String(((index + 1) / count) * 100)}%` }}
            />
          ))
        : null}
    </div>
  );
}

Object.assign(ChartGrid, { displayName: "Chart.Grid" });
