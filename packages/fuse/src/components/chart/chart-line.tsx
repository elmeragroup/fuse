"use client";

import type { ReactElement } from "react";

import type { ChartCurve, ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Line`, a closed part.
 *
 * @beta
 */
export type ChartLineProps = ChartLayerProps & {
  /** The series the line draws. An unknown key throws `unknown-key`. */
  dataKey: string;
  /** The line's look. "default" by default. */
  variant?: "default" | "dashed" | "flowing" | "quiet";
  /** The curve through the readings. "monotone" by default. */
  curve?: ChartCurve;
};

/**
 * One series as a line. A missing reading leaves a gap unless the series' config sets
 * `missing: "connect"`.
 *
 * @beta
 */
export function ChartLine(_props: ChartLineProps): ReactElement {
  return <></>;
}

Object.assign(ChartLine, { displayName: "Chart.Line" });
