"use client";

import type { ReactElement, ReactNode } from "react";

import { useChartRoot } from "./chart-context";
import type { TooltipPlacer } from "./chart-readout-port";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { useCartesianTooltipAnchor } from "./chart-tooltip-anchor";
import { ChartTooltipBody } from "./chart-tooltip-body";
import { ChartTooltipItems, ChartTooltipLabel, ChartTooltipValue } from "./chart-tooltip-parts";
import { ChartTooltipTotal } from "./chart-tooltip-total";
import type { ChartLayerProps } from "./chart-types";

/**
 * Props for `Chart.Tooltip`, a closed part.
 *
 * @beta
 */
export type ChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default. */
  variant?: "default" | "frosted";
  /**
   * Where the popup rests on a vertical chart. "point", the default, centres it on the active slot
   * inside the chart's box and rests it 8 px above the highest mark under its own width. "top" pins
   * it to the plot top and tracks x only, as a chart with Panels always does. A horizontal chart
   * places it over or under the active row either way.
   */
  anchor?: "point" | "top";
  /**
   * Without children, TooltipLabel over a TooltipItems template with Swatch, SeriesLabel and
   * TooltipValue, then one TooltipTotal per stack id that holds two or more series. In pie and
   * radial charts the template renders once, for the active slice or ring.
   */
  children?: ReactNode;
};

const CARTESIAN_PLACER: TooltipPlacer = { useAnchor: useCartesianTooltipAnchor };

/**
 * The popup over the active slot, which a pointer can move into and pin. On a vertical chart it
 * centres on the active slot, held inside the chart Root's box, and rests 8 px above the highest
 * mark under its own width: bars, stack tops, line and area strokes between readings, and dots. A
 * step that raises it raises it over the whole span it travels, and a step that would lower it by
 * 16 px or less keeps its height. It flips below the plot when the viewport has no room above. On
 * a horizontal chart it sits above or below the active row. When neither side has room, it sits
 * beside the column, and when no side has room, it overlays the plot. It touches its anchor and
 * stays inside the viewport, scrolling when its content is taller. A pointer, key or touch step to
 * another slot glides it there over `--chart-glide` on a spring that never overshoots, unless the
 * reader prefers reduced motion, and
 * opening, scrolling, resizing, a data update, a change of side and a path over the marks that would
 * leave the viewport move it at once. Touch passes
 * through the popup to the plot, except on a popup that scrolls, where a drag scrolls it and a tap
 * dismisses it. It may leave the chart. A pointer that moves straight up or down stays on the slot,
 * so it reaches the popup with the content unchanged. The popup stays while the pointer is on the
 * plot or inside the popup and while the option has focus. Escape closes it and keeps the reader's
 * place. It is hidden from screen readers, which read the same values from the plot's option.
 *
 * @beta
 */
export function ChartTooltip({
  variant = "default",
  anchor = "point",
  children,
  ...props
}: ChartTooltipProps): ReactElement {
  return (
    <ChartTooltipBody variant={variant} placement={anchor} placer={CARTESIAN_PLACER} {...props}>
      {children ?? <DefaultTooltip />}
    </ChartTooltipBody>
  );
}

/** The default popup content: the slot label, one row per config key and one total per stack. */
function DefaultTooltip(): ReactElement {
  const { model } = useChartRoot("Chart.Tooltip");
  return (
    <>
      <ChartTooltipLabel />
      <ChartTooltipItems>
        <ChartSwatch />
        <ChartSeriesLabel />
        <ChartTooltipValue />
      </ChartTooltipItems>
      {model.stacks.map(({ id }) => (
        <ChartTooltipTotal key={id} stack={id} />
      ))}
    </>
  );
}

Object.assign(ChartTooltip, { displayName: "Chart.Tooltip" });

export {
  ChartTooltipItems,
  ChartTooltipLabel,
  ChartTooltipShare,
  ChartTooltipValue,
} from "./chart-tooltip-parts";
export type {
  ChartTooltipItemsProps,
  ChartTooltipLabelProps,
  ChartTooltipShareProps,
  ChartTooltipValueProps,
} from "./chart-tooltip-parts";
