"use client";

import type { ReactElement } from "react";

import type { ChartLayerProps } from "./chart-types";

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
 * Lines at the value ticks, behind the marks.
 *
 * @beta
 */
export function ChartGrid(_props: ChartGridProps): ReactElement {
  return <></>;
}

Object.assign(ChartGrid, { displayName: "Chart.Grid" });
