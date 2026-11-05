"use client";

import { use, useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { Table } from "../table/table";
import { useChartRoot } from "./chart-context";
import { usePendingOr } from "./chart-pending-root";
import { useChartReadout } from "./chart-readout";
import type { ChartReadout } from "./chart-readout-port";
import { seriesTable } from "./chart-series-readout";
import { ChartTableBody, ChartTableRowContext } from "./chart-table-body";
import { Twin } from "./chart-table-shell";
import type { ChartLayerProps, ChartScalar, ValueFormat, XFormat } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";
import type { FormattedText } from "./format/formatted-text";
import { formatSlot, PRESET_INTERVAL } from "./format/time-format";
import type { TimePreset } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { ChartDataError, DATA_MESSAGES, isChartDevelopment } from "./layout/errors";
import { numberOf, stringOf } from "./layout/scalar";

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
 * by calendar period, and carries one column per series and per multi-series stack total. Its
 * `TableColumn` children render once in the header row and once in each body row.
 *
 * @beta
 */
export function ChartTable(props: ChartTableProps): ReactElement {
  return usePendingOr(props, ChartTablePart);
}

function ChartTablePart(props: ChartTableProps): ReactElement {
  const context = useChartRoot("Chart.Table");
  const table = useMemo(() => seriesTable(context, context.update.keys), [context]);
  return <ChartTableBody table={table} {...props} />;
}

/** The Intl date-time option names, which tell an `XFormat` object from Intl number options. */
const DATE_FIELDS = new Set([
  "dateStyle",
  "timeStyle",
  "weekday",
  "era",
  "year",
  "month",
  "day",
  "dayPeriod",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "hour12",
  "hourCycle",
]);

/** Whether a format names a time preset. Every ValueFormat is an object, so a string is a preset. */
function isPreset(format: ValueFormat | XFormat): format is TimePreset {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: a TableColumn format is a preset string or an options object
  return typeof format === "string";
}

/** Whether a TableColumn format is an `XFormat`, a time preset or Intl date-time options. */
function isTimeFormat(format: ValueFormat | XFormat): format is XFormat {
  return isPreset(format) || Object.keys(format).some((field) => DATE_FIELDS.has(field));
}

/** The development throw or production warning of `table-column-format`, once per Root and column. */
function formatMismatch(readout: ChartReadout, dataKey: string): void {
  const message = DATA_MESSAGES["table-column-format"];
  if (isChartDevelopment()) throw new ChartDataError("Chart.TableColumn", "table-column-format", message);
  readout.warnOnce("table-column-format", dataKey, `Chart.TableColumn ${message}`);
}

/** A TableColumn cell's text. */
function columnCell(
  readout: ChartReadout,
  timeZone: string,
  dataKey: string,
  cell: ChartScalar,
  format: ValueFormat | XFormat | undefined
): FormattedText {
  const time = format !== undefined && isTimeFormat(format);
  if (cell instanceof Date) {
    if (format !== undefined && !time) formatMismatch(readout, dataKey);
    const preset: XFormat = format !== undefined && time ? format : "date";
    const interval = isPreset(preset) ? PRESET_INTERVAL[preset] : "second";
    return formatSlot(readout.locale, timeZone, cell.getTime(), interval, preset, "full");
  }
  const number = numberOf(cell);
  if (number !== undefined && Number.isFinite(number)) {
    if (time) formatMismatch(readout, dataKey);
    const value = format !== undefined && !time ? format : {};
    return formatValue(readout.locale, number, value, "full");
  }
  const text = stringOf(cell);
  if (text !== undefined) return { text, spoken: text };
  return { text: "–", spoken: CHART_STRINGS[readout.locale].missing };
}

/**
 * A table column for a row column that the chart does not plot, such as a change percentage or the
 * hour of a day's peak. Number cells print through a `ValueFormat`, `Date` cells through an
 * `XFormat` in Root's zone, strings verbatim, and every other cell as `–`. A format that does not
 * fit its cells throws `table-column-format` in development, and a column no row holds warns
 * `absent-column` there.
 *
 * @beta
 */
export function ChartTableColumn(props: ChartTableColumnProps): ReactElement {
  return usePendingOr(props, ChartTableColumnBody);
}

function ChartTableColumnBody({
  dataKey,
  header,
  format,
  className,
  style,
}: ChartTableColumnProps): ReactElement {
  const readout = useChartReadout("Chart.TableColumn");
  const row = use(ChartTableRowContext);
  if (row?.kind === "header") {
    if (isChartDevelopment() && !row.table.hasColumn(dataKey)) {
      readout.warnOnce(
        "absent-column",
        dataKey,
        `Chart.TableColumn lists ${JSON.stringify(dataKey)}, a column no row holds, so every cell prints –. Check the dataKey against the rows.`
      );
    }
    return (
      <Table.Head scope="col" className={className} style={style}>
        <span data-slot="chart-table-column">{header}</span>
      </Table.Head>
    );
  }
  if (row === null) return <></>;
  const cell = row.table.cell(row.slot, dataKey);
  return (
    <Table.Cell className={className} style={style}>
      <span data-slot="chart-table-column">
        <Twin text={columnCell(readout, row.table.timeZone, dataKey, cell, format)} />
      </span>
    </Table.Cell>
  );
}

Object.assign(ChartTable, { displayName: "Chart.Table" });
Object.assign(ChartTableColumn, { displayName: "Chart.TableColumn" });
