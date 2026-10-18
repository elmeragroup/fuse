"use client";

import type { ReactElement } from "react";

import type { ChartDomProps, ValueFormat } from "./chart-types";

/**
 * Props for `Chart.TooltipTotal`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipTotalProps = ChartDomProps<"div"> & {
  /** A config stack id. The first stack id in config order is the default. */
  stack?: string;
  /** The row's label. The dictionary's "Totalt" is the default. */
  label?: string;
  /** The total's format. The stack's first series' format is the default. */
  format?: ValueFormat;
};

/**
 * A tooltip row with one stack's net total at the active slot, followed by the incomplete word when
 * a part is missing. Only cartesian config takes `stack`, so only `Chart` has this part.
 *
 * @beta
 */
export function ChartTooltipTotal(_props: ChartTooltipTotalProps): ReactElement {
  return <></>;
}

Object.assign(ChartTooltipTotal, { displayName: "Chart.TooltipTotal" });
