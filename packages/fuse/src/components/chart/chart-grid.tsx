"use client";

import type { ReactElement } from "react";

import { useChartLayout, useChartRoot } from "./chart-context";
import { useChartFrame } from "./chart-plot";
import type { ChartLayerProps } from "./chart-types";
import { hairline, ruleAcross, slotBand, valueAt } from "./layout/plot-frame";

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
 * hang below a visible zero line. Lines across the value axis sit between the slots. Every line
 * is a hairline, 1 px rounded down to whole device pixels, on the device pixel grid.
 *
 * @beta
 */
export function ChartGrid({
  orientation,
  variant = "solid",
  className,
  style,
}: ChartGridProps): ReactElement {
  const { orientation: chartOrientation } = useChartRoot("Chart.Grid");
  const { y } = useChartLayout("Chart.Grid");
  const drawn = useChartFrame("Chart.Grid");
  const valueLines = chartOrientation === "vertical" ? "horizontal" : "vertical";
  const lines = orientation ?? valueLines;
  const showValues = lines === "both" || lines === valueLines;
  const showSlots = lines === "both" || lines !== valueLines;
  const frame = drawn?.frame;
  const across = (at: number, direction: "horizontal" | "vertical") =>
    frame === undefined ? {} : ruleAcross(frame.box, direction, at);
  const slotDirection = valueLines === "horizontal" ? "vertical" : "horizontal";
  return (
    <svg
      data-slot="chart-grid"
      data-variant={variant}
      data-direction={lines}
      aria-hidden="true"
      className={className}
      style={frame === undefined ? style : { "--_rule-width": `${String(hairline(frame.box))}px`, ...style }}>
      {frame === undefined ? null : (
        <>
          {showValues
            ? y.ticks.map((tick) => (
                <line
                  key={`value-${String(tick)}`}
                  data-slot="chart-grid-line"
                  data-axis="value"
                  data-zero={tick === 0 ? "" : undefined}
                  {...across(valueAt(frame, tick), valueLines)}
                />
              ))
            : null}
          {showSlots
            ? Array.from({ length: Math.max(0, frame.count - 1) }, (_, index) => (
                <line
                  key={`slot-${String(index)}`}
                  data-slot="chart-grid-line"
                  data-axis="slot"
                  {...across(slotBand(frame, index + 1)[0], slotDirection)}
                />
              ))
            : null}
        </>
      )}
    </svg>
  );
}

Object.assign(ChartGrid, { displayName: "Chart.Grid" });
