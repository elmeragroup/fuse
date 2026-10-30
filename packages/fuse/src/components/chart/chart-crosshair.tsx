"use client";

import { useRef } from "react";
import type { ReactElement } from "react";

import { useChartRoot } from "./chart-context";
import { useChartFollower } from "./chart-followers";
import { useChartFrame } from "./chart-plot";
import type { ChartLayerProps } from "./chart-types";
import { optionBand, slotLine } from "./layout/plot-frame";

/**
 * Props for `Chart.Crosshair`, a closed part. The Crosshairs of several Panels share one active
 * slot, so they move as one crosshair.
 *
 * @beta
 */
export type ChartCrosshairProps = ChartLayerProps & {
  /**
   * A band over the active slot or a line through it. The default follows `xScale`. A band spans
   * the active slot of the coarsest series in its layout, so an hourly bar's band covers its hour.
   */
  variant?: "line" | "band";
};

/**
 * The marker of the active slot, a band for `xScale="band"` and a line for `"point"` by default.
 * Write one in each Panel that needs one. Root moves it with the pointer by writing its geometry,
 * so a pointer move renders nothing in React. The band covers the same pixel columns as the
 * focused option and the tooltip's anchor.
 *
 * @beta
 */
export function ChartCrosshair({ variant, className, style }: ChartCrosshairProps): ReactElement {
  const { xScale, model } = useChartRoot("Chart.Crosshair");
  const drawn = useChartFrame("Chart.Crosshair");
  const look = variant ?? (xScale === "band" ? "band" : "line");
  const mark = useRef<SVGRectElement>(null);
  useChartFollower("Chart.Crosshair", (active) => {
    const node = mark.current;
    const window = model.window;
    if (node === null || drawn === null || active === null || window === null) return;
    const { frame } = drawn;
    const { box } = frame;
    const vertical = frame.orientation === "vertical";
    const position = active.slot - window.first;
    // A band covers the focused option's columns, and a line marks the slot inside them.
    const [start, end] =
      look === "band" ? optionBand(frame, position, xScale) : slotLine(frame, position, xScale);
    node.setAttribute(vertical ? "x" : "y", String(start));
    node.setAttribute(vertical ? "width" : "height", String(end - start));
    node.setAttribute(vertical ? "y" : "x", "0");
    node.setAttribute(vertical ? "height" : "width", String(vertical ? box.height : box.width));
  });
  return (
    <svg
      data-slot="chart-crosshair"
      data-variant={look}
      aria-hidden="true"
      className={className}
      style={style}>
      {drawn === null ? null : <rect ref={mark} data-slot="chart-crosshair-mark" />}
    </svg>
  );
}

Object.assign(ChartCrosshair, { displayName: "Chart.Crosshair" });
