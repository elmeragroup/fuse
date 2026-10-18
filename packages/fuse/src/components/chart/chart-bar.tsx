"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartDatum, ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Bar`, a closed part.
 *
 * @beta
 */
export type ChartBarProps = ChartLayerProps & {
  /** The series the bars draw. An unknown key throws `unknown-key`. */
  dataKey: string;
  /** The bar's look. "default" by default. */
  variant?:
    | "default"
    | "hatched"
    | "duotone"
    | "duotone-reverse"
    | "gradient"
    | "striped"
    | "blocks"
    | "expandable"
    | "isometric";
  /**
   * The slots to emphasise. `"now"` selects the slot of this series that contains Root's `now`, so
   * an hourly bar on a quarter-hour chart emphasises its whole hour. An x string on a time axis
   * throws `x-type-mismatch`.
   */
  emphasis?: ChartDatum;
  /** The word the option appends to an emphasised slot. The dictionary's "uthevet" is the default. */
  emphasisLabel?: string;
};

/**
 * Props for `Chart.BarGroup`, a closed part.
 *
 * @beta
 */
export type ChartBarGroupProps = ChartLayerProps & {
  /** The config keys that share the band, one sub-band each, in this order. */
  series: readonly string[];
  /** The group's Bar parts. */
  children?: ReactNode;
};

/**
 * One series' bars. Outside a BarGroup each bar fills its band, and series that share a `stack` id
 * stack in it. Inside a BarGroup the bar takes its series' sub-band.
 *
 * @beta
 */
export function ChartBar(_props: ChartBarProps): ReactElement {
  return <></>;
}

/**
 * Bars side by side in one band, one sub-band per entry of `series`. Series that share a `stack` id
 * share one sub-band, at the place of the first of them. Each Bar inside names a listed key, or the
 * group throws `bar-not-in-group`.
 *
 * @beta
 */
export function ChartBarGroup(_props: ChartBarGroupProps): ReactElement {
  return <></>;
}

Object.assign(ChartBar, { displayName: "Chart.Bar" });
Object.assign(ChartBarGroup, { displayName: "Chart.BarGroup" });
