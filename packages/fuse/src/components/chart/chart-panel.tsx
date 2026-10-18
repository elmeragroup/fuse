"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Panel`, a closed part.
 *
 * @beta
 */
export type ChartPanelProps = ChartLayerProps & {
  /**
   * The config keys this Panel draws. Its y domain comes from them, `yBaseline` and `yInclude`, over
   * the rows inside the effective `xRange`. The series cycle and the "all series" option list keys
   * in config order, so write config in Panel order.
   */
  series: readonly string[];
  /** As Root's `yBaseline`, for this Panel's layout. "zero" by default. */
  yBaseline?: "zero" | "none";
  /** As Root's `yInclude`, for this Panel's layout. */
  yInclude?: readonly number[];
  /**
   * The Panel's plot parts. Tooltip, Legend, LegendToggleGroup, Brush, Table, Empty, Headline and
   * Takeaway stay under Root, beside the Panels.
   */
  children?: ReactNode;
};

/**
 * A row with its own y axis and y domain. All Panels share Root's x grid, surface and tooltip. With
 * Panels, every config key sits in exactly one Panel, every plot part sits in a Panel, and the
 * x axis goes in the last Panel. A Panel under `orientation="horizontal"` throws `horizontal-panels`.
 *
 * @beta
 */
export function ChartPanel(_props: ChartPanelProps): ReactElement {
  return <></>;
}

Object.assign(ChartPanel, { displayName: "Chart.Panel" });
