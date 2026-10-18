"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartFallback, ChartLayerProps, ValueFormat } from "./chart-types";

/**
 * Props for `Chart.ActiveValue`, a closed part.
 *
 * @beta
 */
export type ChartActiveValueProps = ChartLayerProps & {
  /** The series to print. */
  dataKey: string;
  /** The datum to print when nothing is active. "last" by default. */
  fallback?: ChartFallback;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.ActiveValueLine`, a closed part.
 *
 * @beta
 */
export type ChartActiveValueLineProps = ChartLayerProps & {
  /** The series whose active value the line marks. */
  dataKey: string;
  /** A `ValueLabel` adds the value as a pill at the value axis. */
  children?: ReactNode;
};

/**
 * The value at the active slot, or the `fallback` value when nothing is active. Inside a Headline
 * it is exposed text. Anywhere else it is plot output that readers skip.
 *
 * @beta
 */
export function ChartActiveValue(_props: ChartActiveValueProps): ReactElement {
  return <></>;
}

/**
 * A line across the plot at the active value.
 *
 * @beta
 */
export function ChartActiveValueLine(_props: ChartActiveValueLineProps): ReactElement {
  return <></>;
}

Object.assign(ChartActiveValue, { displayName: "Chart.ActiveValue" });
Object.assign(ChartActiveValueLine, { displayName: "Chart.ActiveValueLine" });
