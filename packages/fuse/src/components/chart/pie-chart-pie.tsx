"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `PieChart.Pie`, a closed part.
 *
 * @beta
 */
export type PieChartPieProps = ChartLayerProps & {
  /** A fraction of the outer radius, from 0 to 0.5. The plot keeps its aspect, so pixels would mean nothing. */
  cornerRadius?: number;
};

/**
 * Props for `PieChart.Labels`, a closed part.
 *
 * @beta
 */
export type PieChartLabelsProps = ChartLayerProps & {
  /** Where each label sits. An inside label on a role with no on-colour role draws outside instead. */
  position?: "inside" | "outside";
  /** A per-slice template. Without children, SeriesLabel and LegendShare. */
  children?: ReactNode;
};

/**
 * The slices, drawn in data order from `startAngle`, clockwise.
 *
 * @beta
 */
export function PieChartPie(_props: PieChartPieProps): ReactElement {
  return <></>;
}

/**
 * One label per slice. An inside label on a slice whose role has no on-colour role, `chart-other`
 * and the sequential steps, draws outside that slice instead.
 *
 * @beta
 */
export function PieChartLabels(_props: PieChartLabelsProps): ReactElement {
  return <></>;
}

Object.assign(PieChartPie, { displayName: "PieChart.Pie" });
Object.assign(PieChartLabels, { displayName: "PieChart.Labels" });
