"use client";

import { use } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useChartRoot } from "./chart-context";
import { usePendingOr } from "./chart-pending-root";
import {
  ChartRowContext,
  shareDigits,
  shareText,
  useActiveIndex,
  useActiveItem,
  useChartReadout,
  useReadoutKey,
} from "./chart-readout";
import { ChartSelectionContext } from "./chart-readout-port";
import type { TooltipPlacer } from "./chart-readout-port";
import { ChartSeriesLabel, ChartSwatch } from "./chart-series";
import { useCartesianTooltipAnchor } from "./chart-tooltip-anchor";
import { ChartTooltipBody } from "./chart-tooltip-body";
import { ChartTooltipTotal } from "./chart-tooltip-total";
import type {
  ChartDomProps,
  ChartLayerProps,
  ChartFractionDigits,
  ValueFormat,
  XFormat,
} from "./chart-types";

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

/**
 * Props for `Chart.TooltipLabel`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipLabelProps = ChartDomProps<"span"> & {
  /** The slot label format. Root's `xFormat` is the default. It does nothing in polar charts. */
  format?: XFormat;
};

/**
 * Props for `Chart.TooltipItems`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipItemsProps = ChartDomProps<"div">;

/**
 * Props for `Chart.TooltipValue`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipValueProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a TooltipItems row the row supplies it. */
  dataKey?: string;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.TooltipShare`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartTooltipShareProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a TooltipItems row the row supplies it. */
  dataKey?: string;
  /** The percentage digits. */
  format?: ChartFractionDigits;
};

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
export function ChartTooltip(props: ChartTooltipProps): ReactElement {
  return usePendingOr(props, ChartTooltipPart);
}

/** The cartesian anchor, which rests the popup on the marks under it. */
const CARTESIAN_PLACER: TooltipPlacer = { useAnchor: useCartesianTooltipAnchor };

function ChartTooltipPart({
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

/**
 * The active slot's label, or the category's label in pie, radial and radar charts.
 *
 * @beta
 */
export function ChartTooltipLabel(props: ChartTooltipLabelProps): ReactElement {
  return usePendingOr(props, ChartTooltipLabelBody);
}

function ChartTooltipLabelBody({
  format,
  render,
  className,
  ...props
}: ChartTooltipLabelProps): ReactElement {
  const readout = useChartReadout("Chart.TooltipLabel");
  const active = useActiveIndex(readout);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-label",
      ...mergeProps<"span">(
        { className, children: active === null ? null : readout.activeLabel(active, format) },
        props
      ),
    },
  });
}

/**
 * A row template, rendered once per config key at the active point, or once for the active slice
 * or ring. Each row carries `data-series`, and `data-dimmed` while another series is selected.
 *
 * @beta
 */
export function ChartTooltipItems(props: ChartTooltipItemsProps): ReactElement {
  return usePendingOr(props, ChartTooltipItemsBody);
}

function ChartTooltipItemsBody({
  render,
  className,
  children,
  ...props
}: ChartTooltipItemsProps): ReactElement {
  const readout = useChartReadout("Chart.TooltipItems");
  const selectedKey = use(ChartSelectionContext);
  // Only a readout whose rows follow the active item renders on a step.
  const active = useActiveIndex(readout, readout.itemsFollowActive ? undefined : false);
  const rows = readout.tooltipKeys(active).map((key) => (
    <ChartRowContext key={key} value={key}>
      <div
        data-slot="chart-tooltip-item"
        data-series={readout.item(key)?.index}
        data-dimmed={selectedKey !== null && selectedKey !== key ? "" : undefined}>
        {children}
      </div>
    </ChartRowContext>
  ));
  return useRender({
    defaultTagName: "div",
    render,
    props: { "data-slot": "chart-tooltip-items", ...mergeProps<"div">({ className, children: rows }, props) },
  });
}

/**
 * The reading at the active point, followed by its quality and projection words. A series coarser
 * than Root's interval adds its own slot label. Under `stackOffset="expand"` it prints the raw value.
 *
 * @beta
 */
export function ChartTooltipValue(props: ChartTooltipValueProps): ReactElement {
  return usePendingOr(props, ChartTooltipValueBody);
}

function ChartTooltipValueBody({
  dataKey,
  format,
  render,
  className,
  ...props
}: ChartTooltipValueProps): ReactElement {
  const readout = useChartReadout("Chart.TooltipValue");
  const point = useActiveItem(readout);
  const key = useReadoutKey("Chart.TooltipValue", readout, dataKey, point.key);
  const text = key === null || point.index === null ? null : readout.valueText(key, point.index, format);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-value",
      ...mergeProps<"span">({ className, children: text }, props),
    },
  });
}

/**
 * The reading's share as a percentage, signed as the reading is. In cartesian and radar charts the
 * denominator is the sum of the absolute readings of every series at the active slot or spoke, so a
 * share never passes 100 % in magnitude. A slice divides by the absolute total of the slices, and a
 * ring divides by its own maximum. A zero denominator prints the dictionary dash `–`. The shares at
 * one slot share a denominator, so they round together on their magnitudes and keep their signs.
 * Their magnitudes sum to 100 %, so readings of 3 and −1 print 75 % and −25 %. A ring's share
 * against its own maximum has no set and rounds alone.
 *
 * @beta
 */
export function ChartTooltipShare(props: ChartTooltipShareProps): ReactElement {
  return usePendingOr(props, ChartTooltipShareBody);
}

function ChartTooltipShareBody({
  dataKey,
  format,
  render,
  className,
  ...props
}: ChartTooltipShareProps): ReactElement {
  const readout = useChartReadout("Chart.TooltipShare");
  const point = useActiveItem(readout);
  const key = useReadoutKey("Chart.TooltipShare", readout, dataKey, point.key);
  const text =
    key === null || point.index === null
      ? null
      : shareText(readout.locale, readout.share(key, point.index, shareDigits(format)), format);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-tooltip-share",
      ...mergeProps<"span">({ className, children: text }, props),
    },
  });
}

Object.assign(ChartTooltip, { displayName: "Chart.Tooltip" });
Object.assign(ChartTooltipLabel, { displayName: "Chart.TooltipLabel" });
Object.assign(ChartTooltipItems, { displayName: "Chart.TooltipItems" });
Object.assign(ChartTooltipValue, { displayName: "Chart.TooltipValue" });
Object.assign(ChartTooltipShare, { displayName: "Chart.TooltipShare" });
