"use client";

/**
 * ClockChart's TooltipTotal: a tooltip row with one stack's net total at the active slot. It keeps
 * a module of its own, so a route with the Center ships no tooltip row, and one with the Tooltip
 * ships no Center.
 */
import type { ReactElement } from "react";

import { useActiveIndex } from "./chart-active-point";
import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartTooltipTotalProps } from "./chart-tooltip-total";
import { TooltipTotalRow } from "./chart-tooltip-total-row";

/**
 * A tooltip row with one stack's net total at the active slot, followed by the incomplete word when
 * a part is missing. A `stack` that names no stack of two or more series throws `unknown-key`.
 *
 * @beta
 */
export function ClockChartTooltipTotal(props: ChartTooltipTotalProps): ReactElement {
  const { model, kernel } = usePolarContext("ClockChart.TooltipTotal", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.TooltipTotal");
  const slot = useActiveIndex({ store: kernel.store, window: clock.text.model.window });
  return <TooltipTotalRow part="ClockChart.TooltipTotal" context={clock.text} at={slot} {...props} />;
}

Object.assign(ClockChartTooltipTotal, { displayName: "ClockChart.TooltipTotal" });
