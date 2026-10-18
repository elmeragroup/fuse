"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartDomProps, ChartLayerProps, ChartShareFormat, ValueFormat, XFormat } from "./chart-types";

/**
 * Props for `Chart.Tooltip`, a closed part.
 *
 * @beta
 */
export type ChartTooltipProps = ChartLayerProps & {
  /** The popup's surface. "default" by default. */
  variant?: "default" | "frosted";
  /** "point" follows the active mark. "top" pins the popup to the plot top and tracks x only. */
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
  format?: ChartShareFormat;
};

/**
 * The popup over the active slot, which a pointer can move into and pin. It is hidden from screen
 * readers, which read the same values from the plot's option.
 *
 * @beta
 */
export function ChartTooltip(_props: ChartTooltipProps): ReactElement {
  return <></>;
}

/**
 * The active slot's label, or the category's label in pie, radial and radar charts.
 *
 * @beta
 */
export function ChartTooltipLabel(_props: ChartTooltipLabelProps): ReactElement {
  return <></>;
}

/**
 * A row template, rendered once per config key at the active point, or once for the active slice
 * or ring.
 *
 * @beta
 */
export function ChartTooltipItems(_props: ChartTooltipItemsProps): ReactElement {
  return <></>;
}

/**
 * The reading at the active point, followed by its quality and projection words. A series coarser
 * than Root's interval adds its own slot label. Under `stackOffset="expand"` it prints the raw value.
 *
 * @beta
 */
export function ChartTooltipValue(_props: ChartTooltipValueProps): ReactElement {
  return <></>;
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
export function ChartTooltipShare(_props: ChartTooltipShareProps): ReactElement {
  return <></>;
}

Object.assign(ChartTooltip, { displayName: "Chart.Tooltip" });
Object.assign(ChartTooltipLabel, { displayName: "Chart.TooltipLabel" });
Object.assign(ChartTooltipItems, { displayName: "Chart.TooltipItems" });
Object.assign(ChartTooltipValue, { displayName: "Chart.TooltipValue" });
Object.assign(ChartTooltipShare, { displayName: "Chart.TooltipShare" });
