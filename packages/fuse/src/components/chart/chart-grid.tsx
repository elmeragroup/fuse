"use client";

import type { ReactElement } from "react";

import { usePlotLayout, useChartRoot } from "./chart-context";
import { useChartFrame } from "./chart-plot";
import type { ChartLayerProps } from "./chart-types";
import { alongLength, hairline, ruleAcross, slotBand, valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";
import { domainShare } from "./layout/tick-fit";
import type { ValueDomain } from "./layout/value-domain";

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
  /** The line style. `solid` matches the Figma `Chart` component. */
  variant?: "solid" | "dashed";
};

/**
 * Lines at the value ticks, behind the marks. The line at 0 always draws solid, so negative values
 * hang below a visible zero line. Lines across the value axis sit between the slots, or at the x
 * axis's nice ticks under `xScale="linear"`, where they meet XAxis's labels. Every line is a
 * hairline, 1 px rounded down to whole device pixels, on the device pixel grid.
 *
 * @beta
 */
export function ChartGrid({
  orientation,
  variant = "solid",
  className,
  style,
}: ChartGridProps): ReactElement {
  const { orientation: chartOrientation, model } = useChartRoot("Chart.Grid");
  const layout = usePlotLayout("Chart.Grid");
  const { y } = layout;
  const drawn = useChartFrame("Chart.Grid", layout);
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
            ? slotLines(frame, model.x).map(({ key, at }) => (
                <line key={key} data-slot="chart-grid-line" data-axis="slot" {...across(at, slotDirection)} />
              ))
            : null}
        </>
      )}
    </svg>
  );
}

/**
 * The lines across the value axis: one between each two slots, or one at each nice tick of a linear
 * axis's x domain.
 */
function slotLines(
  frame: PlotFrame,
  x: ValueDomain | null
): readonly { readonly key: string; readonly at: number }[] {
  if (x !== null) {
    const length = alongLength(frame);
    return x.ticks.map((tick) => ({ key: `x-${String(tick)}`, at: domainShare(x.domain, tick) * length }));
  }
  return Array.from({ length: Math.max(0, frame.count - 1) }, (_, index) => ({
    key: `slot-${String(index)}`,
    at: slotBand(frame, index + 1)[0],
  }));
}

Object.assign(ChartGrid, { displayName: "Chart.Grid" });
