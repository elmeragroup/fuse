"use client";

import type { ReactElement } from "react";

import type { ChartLayerProps, ValueFormat } from "./chart-types";

/**
 * Props for `RadarChart.Grid`, a closed part.
 *
 * @beta
 */
export type RadarChartGridProps = ChartLayerProps & {
  /** The ring shape. "polygon" by default. */
  variant?: "polygon" | "circle";
};

/**
 * Props for `RadarChart.AngleAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartAngleAxisProps = ChartLayerProps;

/**
 * Props for `RadarChart.RadiusAxis`, a closed part.
 *
 * @beta
 */
export type RadarChartRadiusAxisProps = ChartLayerProps & {
  /** The tick label format. The first series' `format` is the default. */
  format?: ValueFormat;
};

/**
 * The rings and spokes. When the radius domain reaches below 0 it draws the zero ring solid.
 *
 * @beta
 */
export function RadarChartGrid(_props: RadarChartGridProps): ReactElement {
  return <></>;
}

/**
 * The spoke labels, one per row.
 *
 * @beta
 */
export function RadarChartAngleAxis(_props: RadarChartAngleAxisProps): ReactElement {
  return <></>;
}

/**
 * The value ticks along the first spoke.
 *
 * @beta
 */
export function RadarChartRadiusAxis(_props: RadarChartRadiusAxisProps): ReactElement {
  return <></>;
}

Object.assign(RadarChartGrid, { displayName: "RadarChart.Grid" });
Object.assign(RadarChartAngleAxis, { displayName: "RadarChart.AngleAxis" });
Object.assign(RadarChartRadiusAxis, { displayName: "RadarChart.RadiusAxis" });
