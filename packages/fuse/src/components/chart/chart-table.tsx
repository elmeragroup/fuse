"use client";

import type { ReactElement, ReactNode } from "react";

import type { ChartLayerProps, ValueFormat, XFormat } from "./chart-types";

/**
 * Props for `Chart.Table`, a closed part.
 *
 * @beta
 */
export type ChartTableProps = ChartLayerProps & {
  /** Replaces the generated caption, the chart name and the period. */
  caption?: string;
  /** Replaces the first column's header, which the interval picks. */
  xHeader?: string;
  /** Replaces the dictionary's "Vis som tabell". */
  showLabel?: string;
  /** Replaces the dictionary's "Skjul tabell". */
  hideLabel?: string;
  /** Extra columns as `TableColumn` parts, after the series and total columns. */
  children?: ReactNode;
};

/**
 * Props for `Chart.TableColumn`, a closed part.
 *
 * @beta
 */
export type ChartTableColumnProps = ChartLayerProps & {
  /** The row column to list. It names a row column, not a config key. */
  dataKey: string;
  /** The column header. */
  header: string;
  /** How number and `Date` cells print. */
  format?: ValueFormat | XFormat;
};

/**
 * A "Vis som tabell" button and the chart's data as a table, which stays in the accessibility tree
 * while it is visually collapsed. The table lists every slot of the full data, pages past 500 rows
 * by calendar period, and carries one column per series and per multi-series stack total.
 *
 * @beta
 */
export function ChartTable(_props: ChartTableProps): ReactElement {
  return <></>;
}

/**
 * A table column for a row column that the chart does not plot, such as a change percentage or the
 * hour of a day's peak. Number cells print through a `ValueFormat`, `Date` cells through an
 * `XFormat` in Root's zone, strings verbatim, and every other cell as `–`.
 *
 * @beta
 */
export function ChartTableColumn(_props: ChartTableColumnProps): ReactElement {
  return <></>;
}

Object.assign(ChartTable, { displayName: "Chart.Table" });
Object.assign(ChartTableColumn, { displayName: "Chart.TableColumn" });
