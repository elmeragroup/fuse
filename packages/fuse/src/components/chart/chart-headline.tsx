"use client";

import type { ReactElement } from "react";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `Chart.Headline`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartHeadlineProps = ChartDomProps<"div">;

/**
 * Props for `Chart.Takeaway`, a `p` with Base UI's `render` whose children stay text.
 *
 * @beta
 */
export type ChartTakeawayProps = Omit<ChartDomProps<"p">, "children"> & {
  /** The takeaway sentence. Interpolated strings and numbers pass, and elements fail the type. */
  children: string | number | readonly (string | number)[];
};

/**
 * The key figure above the chart, such as `1,78 kr` over `Spotpris nå 16:00–16:15`. Format a static
 * figure with `formatChartValue` and `formatChartSlot`, or place an `ActiveValue`, which is exposed
 * text here.
 *
 * @beta
 */
export function ChartHeadline(_props: ChartHeadlineProps): ReactElement {
  return <></>;
}

/**
 * The takeaway in words, such as `Prisen er lavest kl. 03`. Fuse never writes one and never copies
 * it into the description.
 *
 * @beta
 */
export function ChartTakeaway(_props: ChartTakeawayProps): ReactElement {
  return <></>;
}

Object.assign(ChartHeadline, { displayName: "Chart.Headline" });
Object.assign(ChartTakeaway, { displayName: "Chart.Takeaway" });
