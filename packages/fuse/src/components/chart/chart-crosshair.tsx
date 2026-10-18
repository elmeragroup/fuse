"use client";

import type { ReactElement } from "react";

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
 * Write one in each Panel that needs one.
 *
 * @beta
 */
export function ChartCrosshair(_props: ChartCrosshairProps): ReactElement {
  return <></>;
}

Object.assign(ChartCrosshair, { displayName: "Chart.Crosshair" });
