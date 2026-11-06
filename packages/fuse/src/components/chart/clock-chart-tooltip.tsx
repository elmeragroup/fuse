"use client";

/**
 * ClockChart's Tooltip: the polar popup over the active slot, whose default content adds a total
 * row per stack of two or more series, as the table and the option name them.
 */
import type { ReactElement } from "react";

import { clockDrawingIn, usePolarContext } from "./chart-polar-context";
import type { ChartTooltipProps } from "./chart-tooltip";
import { ClockChartTooltipTotal } from "./clock-chart-tooltip-total";
import { DefaultPolarTooltip, PolarTooltip } from "./polar-chart-tooltip";

/** The default content: the slot's label and rows, then one total per stack of two or more series. */
function DefaultClockTooltip(): ReactElement {
  const { model } = usePolarContext("ClockChart.Tooltip", ["clock"]);
  const clock = clockDrawingIn(model, "ClockChart.Tooltip");
  return (
    <>
      <DefaultPolarTooltip />
      {clock.text.model.stacks.map(({ id }) => (
        <ClockChartTooltipTotal key={id} stack={id} />
      ))}
    </>
  );
}

/**
 * The popup over the active slot, with one row per series and, by default, one total per stack of
 * two or more series. It rests in a side lane beside the dial at the height where the hand meets the
 * rim, moving with the hand, and a step that leaps across the dial fades it in where the step lands,
 * as a change of lane does. A side lane takes it only when the lane's room holds its content;
 * otherwise it rests below the dial and its labels. Like `Chart.Tooltip`'s, it may reach past the
 * chart's box, below it, and stays inside the viewport, but it never covers its dial, its labels or
 * its title. Escape closes it and keeps the reader's place. `anchor` does nothing here, since the
 * lane decides where the popup rests.
 *
 * @beta
 */
export function ClockChartTooltip({ children, ...props }: ChartTooltipProps): ReactElement {
  return <PolarTooltip {...props}>{children ?? <DefaultClockTooltip />}</PolarTooltip>;
}

Object.assign(ClockChartTooltip, { displayName: "ClockChart.Tooltip" });
