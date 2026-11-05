"use client";

/**
 * The tooltip's content parts every chart family shares: the active datum's label, the row
 * template, the value and the share. Each reads its Root through the readout port, so a family's
 * Tooltip and its content ship no other family's code.
 */
import { use } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

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
import type { ChartDomProps, ChartFractionDigits, ValueFormat, XFormat } from "./chart-types";

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

/** The cartesian anchor, which rests the popup on the marks under it. */

/**
 * The active slot's label, or the category's label in pie, radial and radar charts.
 *
 * @beta
 */
export function ChartTooltipLabel({
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
export function ChartTooltipItems({
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
export function ChartTooltipValue({
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
export function ChartTooltipShare({
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

Object.assign(ChartTooltipLabel, { displayName: "Chart.TooltipLabel" });
Object.assign(ChartTooltipItems, { displayName: "Chart.TooltipItems" });
Object.assign(ChartTooltipValue, { displayName: "Chart.TooltipValue" });
Object.assign(ChartTooltipShare, { displayName: "Chart.TooltipShare" });
