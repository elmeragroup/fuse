"use client";

import type { ReactElement } from "react";

import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `RadialChart.Bar`, a closed part.
 *
 * @beta
 */
export type RadialChartBarProps = ChartLayerProps & {
  /** The ring's look. "default" by default. */
  variant?: "default" | "dotted";
};

/**
 * The rings, one per row, the first outermost. Each fills its share of its maximum and never laps.
 *
 * @beta
 */
export function RadialChartBar(_props: RadialChartBarProps): ReactElement {
  return <></>;
}

Object.assign(RadialChartBar, { displayName: "RadialChart.Bar" });
