"use client";

import type { ReactElement, ReactNode } from "react";

import type {
  ChartDomProps,
  ChartFallback,
  ChartLayerProps,
  ChartShareFormat,
  ValueFormat,
} from "./chart-types";

/**
 * Props for `Chart.Legend`, a `ul` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendProps = ChartDomProps<"ul"> & {
  /** Where the legend sits around the plot. "bottom" by default. */
  side?: "top" | "bottom" | "start" | "end";
};

/**
 * Props for `Chart.LegendItem`, an `li` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendItemProps = ChartDomProps<"li"> & {
  /** The series of this item. Without one, the item is a template rendered once per legend entry. */
  dataKey?: string;
};

/**
 * Props for `Chart.LegendValue`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendValueProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a LegendItem template the item supplies it. */
  dataKey?: string;
  /** The datum to print when nothing is active. "last" by default. */
  fallback?: ChartFallback;
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/**
 * Props for `Chart.LegendShare`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartLegendShareProps = ChartDomProps<"span"> & {
  /** The series to print. Inside a LegendItem template the item supplies it. */
  dataKey?: string;
  /** The percentage digits. */
  format?: ChartShareFormat;
};

/**
 * Props for `Chart.LegendToggleGroup`, a closed part.
 *
 * @beta
 */
export type ChartLegendToggleGroupProps = ChartLayerProps & {
  /** The group's name. The dictionary's "Serier" is the default. */
  "aria-label"?: string;
  /** Where the group sits around the plot. "bottom" by default. */
  side?: ChartLegendProps["side"];
  /** LegendToggle parts. Without children, one per config key, or per kept category in a folded pie. */
  children?: ReactNode;
};

/**
 * Props for `Chart.LegendToggle`, a closed part.
 *
 * @beta
 */
export type ChartLegendToggleProps = ChartLayerProps & {
  /** The series the toggle selects. An unknown key throws `unknown-key`. */
  dataKey: string;
  /** The toggle's content. The series' swatch and label by default. */
  children?: ReactNode;
};

/**
 * A static list of the series, "bottom" by default, as Figma's `Chart` places it. Without children,
 * one LegendItem per config key, or per kept category and then one Other item in a folded pie.
 *
 * @beta
 */
export function ChartLegend(_props: ChartLegendProps): ReactElement {
  return <></>;
}

/**
 * One legend entry. With a `dataKey`, one item. Without one, a template rendered once per legend
 * entry, as TooltipItems is.
 *
 * @beta
 */
export function ChartLegendItem(_props: ChartLegendItemProps): ReactElement {
  return <></>;
}

/**
 * The series' value at the active slot, or the `fallback` value when nothing is active. In pie and
 * radial charts it is the category's value.
 *
 * @beta
 */
export function ChartLegendValue(_props: ChartLegendValueProps): ReactElement {
  return <></>;
}

/**
 * The series total's share of every series' total over the effective window, or the slice's share
 * in a pie.
 *
 * @beta
 */
export function ChartLegendShare(_props: ChartLegendShareProps): ReactElement {
  return <></>;
}

/**
 * A Fuse ToggleGroup that edits Root's `selectedKey`. Root owns the value and the change callback,
 * so the group takes no `value`, `multiple` or `disabled` of its own.
 *
 * @beta
 */
export function ChartLegendToggleGroup(_props: ChartLegendToggleGroupProps): ReactElement {
  return <></>;
}

/**
 * One series toggle, named by the visible text of the series label, so a speech-input user can say
 * what they see.
 *
 * @beta
 */
export function ChartLegendToggle(_props: ChartLegendToggleProps): ReactElement {
  return <></>;
}

Object.assign(ChartLegend, { displayName: "Chart.Legend" });
Object.assign(ChartLegendItem, { displayName: "Chart.LegendItem" });
Object.assign(ChartLegendValue, { displayName: "Chart.LegendValue" });
Object.assign(ChartLegendShare, { displayName: "Chart.LegendShare" });
Object.assign(ChartLegendToggleGroup, { displayName: "Chart.LegendToggleGroup" });
Object.assign(ChartLegendToggle, { displayName: "Chart.LegendToggle" });
