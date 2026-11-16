"use client";

import type { ReactElement } from "react";

import { useActiveIndex } from "./chart-active-point";
import { useChartRoot } from "./chart-context";
import { TooltipTotalRow } from "./chart-tooltip-total-row";
import type { ChartDomProps, ValueFormat } from "./chart-types";

/**
 * Props for `Chart.TooltipTotal`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipTotalProps = ChartDomProps<"div"> & {
  /** A config stack id. Defaults to the first stack id in config order. */
  stack?: string;
  /** The row's label. Defaults to the dictionary's "Totalt". */
  label?: string;
  /** The total's format. Defaults to the stack's first series' format. */
  format?: ValueFormat;
};

/**
 * A tooltip row with one stack's net total at the active slot, followed by the incomplete word when
 * a part is missing. Cartesian and clock config take `stack`, so `Chart` and `ClockChart` have this
 * part. A `stack` that names no stack of two or more series throws `unknown-key`.
 *
 * @beta
 */
export function ChartTooltipTotal(props: ChartTooltipTotalProps): ReactElement {
  const context = useChartRoot("Chart.TooltipTotal");
  const slot = useActiveIndex({ store: context.store, window: context.model.window });
  return <TooltipTotalRow part="Chart.TooltipTotal" context={context} at={slot} {...props} />;
}

Object.assign(ChartTooltipTotal, { displayName: "Chart.TooltipTotal" });
