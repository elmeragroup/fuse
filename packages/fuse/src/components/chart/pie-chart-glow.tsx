"use client";

import type { ReactElement } from "react";

import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `PieChart.Glow`, a closed part.
 *
 * @beta
 */
export type PieChartGlowProps = ChartLayerProps & {
  /** The category whose slice or ring glows. */
  dataKey: string;
};

/**
 * A glow on one slice or ring. It names a category, because Root owns the slice and ring geometry,
 * so a wrapper could not target one slice.
 *
 * @beta
 */
export function PieChartGlow(_props: PieChartGlowProps): ReactElement {
  return <></>;
}

Object.assign(PieChartGlow, { displayName: "PieChart.Glow" });
