"use client";

import { useRef } from "react";
import type { ReactElement } from "react";

import { useChartRoot, usePlotLayout } from "./chart-context";
import { writeAttribute } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import { useChartFrame } from "./chart-plot";
import type { ChartLayerProps } from "./chart-types";
import { coarsestOf, ownSlot } from "./layout/coarse-slots";
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
  const layout = usePlotLayout("Chart.Crosshair");
  const { keys } = layout;
  const drawn = useChartFrame("Chart.Crosshair", layout);
  // A band spans the active slot of the layout's coarsest series, so an hourly bar's band covers its hour.
  const coarsest = coarsestOf(model.series.filter(({ key }) => keys.includes(key)));
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
    const [first, last] =
      coarsest === undefined ? [active.slot, active.slot] : ownSlot(coarsest, active.slot);
    // A band covers the focused option's columns, or its coarse slot's, and a line marks the slot.
    const [start, end] =
      look === "band"
        ? [
            optionBand(frame, Math.max(first, window.first) - window.first, xScale)[0],
            optionBand(frame, Math.min(last, window.last) - window.first, xScale)[1],
          ]
        : slotLine(frame, position, xScale);
    writeAttribute(node, vertical ? "x" : "y", start);
    writeAttribute(node, vertical ? "width" : "height", end - start);
    // The cross axis spans the plot, which a step leaves alone, so only a resize writes it.
    writeAttribute(node, vertical ? "y" : "x", 0);
    writeAttribute(node, vertical ? "height" : "width", vertical ? box.height : box.width);
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
