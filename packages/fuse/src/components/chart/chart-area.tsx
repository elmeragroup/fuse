"use client";

import type { ReactElement } from "react";

import type { ChartCurve, ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Area`, a closed part.
 *
 * @beta
 */
export type ChartAreaProps = ChartLayerProps & {
  /** The series the area draws. An unknown key throws `unknown-key`. */
  dataKey: string;
  /** The fill's look. "gradient" by default. */
  variant?: "gradient" | "gradient-reverse" | "solid" | "dotted" | "lines" | "hatched";
  /** The curve along the area's edge. "monotone" by default. */
  curve?: ChartCurve;
};

/**
 * One series as a filled area down to the baseline, which is 0 in every layout an Area sits in.
 *
 * @beta
 */
export function ChartArea(_props: ChartAreaProps): ReactElement {
  return <></>;
}

Object.assign(ChartArea, { displayName: "Chart.Area" });
