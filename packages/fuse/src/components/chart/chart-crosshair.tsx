"use client";

import type { ReactElement } from "react";

import { useChartRoot } from "./chart-context";
import type { ChartLayerProps } from "./chart-types";

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
 * Write one in each Panel that needs one. It follows the pointer through Root's custom properties,
 * so a pointer move renders nothing in React.
 *
 * @beta
 */
export function ChartCrosshair({ variant, className, style }: ChartCrosshairProps): ReactElement {
  const { xScale } = useChartRoot("Chart.Crosshair");
  return (
    <div
      data-slot="chart-crosshair"
      data-variant={variant ?? (xScale === "band" ? "band" : "line")}
      data-follow=""
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}

Object.assign(ChartCrosshair, { displayName: "Chart.Crosshair" });
