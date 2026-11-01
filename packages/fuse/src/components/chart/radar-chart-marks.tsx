"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `RadarChart.Area`, a closed part.
 *
 * @beta
 */
export type RadarChartAreaProps = ChartLayerProps & {
  /** The series the area fills. */
  dataKey: string;
};

/**
 * Props for `RadarChart.Line`, a closed part.
 *
 * @beta
 */
export type RadarChartLineProps = ChartLayerProps & {
  /** The series the outline draws. */
  dataKey: string;
  /** The outline's look. "default" by default. */
  variant?: "default" | "dashed" | "quiet";
};

/**
 * Props for `RadarChart.Dots`, a closed part.
 *
 * @beta
 */
export type RadarChartDotsProps = ChartLayerProps & {
  /** The series whose readings get a dot. */
  dataKey: string;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring";
};

/**
 * Props for `RadarChart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type RadarChartActiveDotProps = ChartLayerProps & {
  /** The series the dot follows. */
  dataKey: string;
};

/**
 * Props for `RadarChart.Glow`, a closed part.
 *
 * @beta
 */
export type RadarChartGlowProps = ChartLayerProps & {
  /** The radar marks to glow. */
  children?: ReactNode;
};

/**
 * Fills between the zero polygon and the series edge with `fill-rule: evenodd`, as one path of
 * per-edge quadrilaterals. The zero polygon joins the radius of 0 on every spoke with straight edges
 * under both Grid variants, and it is the centre when no value is negative. A filled radar is an
 * Area plus a Line.
 *
 * @beta
 */
export function RadarChartArea(_props: RadarChartAreaProps): ReactElement {
  return <></>;
}

/**
 * The series polygon's outline. An outline radar is a Line alone.
 *
 * @beta
 */
export function RadarChartLine(_props: RadarChartLineProps): ReactElement {
  return <></>;
}

/**
 * A dot on every reading of one series.
 *
 * @beta
 */
export function RadarChartDots(_props: RadarChartDotsProps): ReactElement {
  return <></>;
}

/**
 * The dot on one series at the active spoke.
 *
 * @beta
 */
export function RadarChartActiveDot(_props: RadarChartActiveDotProps): ReactElement {
  return <></>;
}

/**
 * Wraps radar marks and glows their drawn layer.
 *
 * @beta
 */
export function RadarChartGlow(_props: RadarChartGlowProps): ReactElement {
  return <></>;
}

Object.assign(RadarChartArea, { displayName: "RadarChart.Area" });
Object.assign(RadarChartLine, { displayName: "RadarChart.Line" });
Object.assign(RadarChartDots, { displayName: "RadarChart.Dots" });
Object.assign(RadarChartActiveDot, { displayName: "RadarChart.ActiveDot" });
Object.assign(RadarChartGlow, { displayName: "RadarChart.Glow" });
