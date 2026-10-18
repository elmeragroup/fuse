"use client";

import type { ReactElement } from "react";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `Chart.Swatch`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartSwatchProps = ChartDomProps<"span"> & {
  /** The series to paint. Inside a template row the row supplies it. */
  dataKey?: string;
  /** The swatch's shape. "square" by default. */
  variant?: "square" | "circle" | "square-outline" | "circle-outline" | "line" | "bar";
};

/**
 * Props for `Chart.SeriesLabel`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartSeriesLabelProps = ChartDomProps<"span"> & {
  /** The series to name. Inside a template row the row supplies it. */
  dataKey?: string;
};

/**
 * Props for `Chart.SeriesIcon`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartSeriesIconProps = ChartDomProps<"span"> & {
  /** The series whose config `icon` to show. Inside a template row the row supplies it. */
  dataKey?: string;
};

/**
 * The series' paint. A role list shows the list as a gradient, and a scale shows its ramp. Inside a
 * tooltip row a scale series shows the step of the active value.
 *
 * @beta
 */
export function ChartSwatch(_props: ChartSwatchProps): ReactElement {
  return <></>;
}

/**
 * The series' visible label from config.
 *
 * @beta
 */
export function ChartSeriesLabel(_props: ChartSeriesLabelProps): ReactElement {
  return <></>;
}

/**
 * The series' config `icon`, or nothing when it has none.
 *
 * @beta
 */
export function ChartSeriesIcon(_props: ChartSeriesIconProps): ReactElement {
  return <></>;
}

Object.assign(ChartSwatch, { displayName: "Chart.Swatch" });
Object.assign(ChartSeriesLabel, { displayName: "Chart.SeriesLabel" });
Object.assign(ChartSeriesIcon, { displayName: "Chart.SeriesIcon" });
