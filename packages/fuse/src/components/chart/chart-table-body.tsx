"use client";

/**
 * The table every chart family shares: a "Vis som tabell" button and the chart's data as a table,
 * paged in the shell's pagination, with each TableColumn rendered in the header row and in each
 * body row. The family's Table part hands it the table model, so a route that renders no Table
 * ships no family's rows. TableColumn, the extra column every family's Table takes, lives here
 * too.
 */
import { createContext, Fragment, use, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Table } from "../table/table";
import { useChartReadout } from "./chart-readout";
import type { ChartReadout, ChartTableCell, ChartTableModel } from "./chart-readout-port";
import { ChartTableShell, Twin, useTableDisclosure } from "./chart-table-shell";
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

/** What a family's Table part passes the shared body: the Table's props and the family's rows. */
export type ChartTableBodyProps = ChartTableProps & { readonly table: ChartTableModel };

/**
 * Where a TableColumn renders, in the header row or in the body row of one index, and the table
 * model whose rows it extends.
 */
export type TableRowValue =
  | { readonly kind: "header"; readonly table: ChartTableModel }
  | { readonly kind: "row"; readonly slot: number; readonly table: ChartTableModel };

/** The row a TableColumn renders in, or null outside a Table. */
export const ChartTableRowContext = createContext<TableRowValue | null>(null);

/**
 * One body cell: its text with each word in parentheses after it, or words for screen readers
 * alone. The space before each word sits outside the word's muted span, because accessible-name
 * rules that join inline children drop a space inside it, and a reader would hear "0,42(estimert)".
 */
function BodyCell({ cell }: { readonly cell: ChartTableCell }): ReactNode {
  if (cell.kind === "covered") return null;
  const span = cell.rows > 1 ? { rowSpan: cell.rows } : {};
  if (cell.kind === "silent") {
    return (
      <Table.Cell {...span}>
        <span className="sr-only">{cell.spoken}</span>
      </Table.Cell>
    );
  }
  return (
    <Table.Cell {...span}>
      <Twin text={cell.text} />
      {cell.words.map((word) => (
        <Fragment key={word}>
          {" "}
          <span data-quality="">{`(${word})`}</span>
        </Fragment>
      ))}
    </Table.Cell>
  );
}

/**
 * The table over a family's model. It lists the model's pages and renders the shown page's rows.
 *
 * @param props - The Table's props and the family's table model.
 * @returns The table, or an empty fragment while the Root draws nothing.
 */
export function ChartTableBody({
  table,
  caption,
  xHeader,
  showLabel,
  hideLabel,
  className,
  style,
  children,
}: ChartTableBodyProps): ReactElement {
  const readout = useChartReadout("Chart.Table");
  const strings = CHART_STRINGS[readout.locale];
  const disclosure = useTableDisclosure();
  const [pageKey, setPageKey] = useState<number | null>(null);
  const pages = table.pages();
  // A vanished page period clamps to the nearest remaining one.
  let index = 0;
  if (pageKey !== null) {
    let distance = Number.POSITIVE_INFINITY;
    pages.forEach((page, position) => {
      const gap = Math.abs(page.key - pageKey);
      if (gap < distance) {
        distance = gap;
        index = position;
      }
    });
  }
  const page = pages[index] ?? { key: 0, slots: [], label: "", spoken: "" };
  if (readout.empty) return <></>;
  const go = (next: number): void => {
    const target = pages[next];
    if (target === undefined || next === index) return;
    setPageKey(target.key);
    // The status region reads the spoken period, such as `week 41` for the visible `W41`.
    readout.store.announce(strings.pageStatus(String(next + 1), String(pages.length), target.spoken));
  };
  return (
    <ChartTableShell
      disclosure={disclosure}
      tableId={`${readout.id}-rows`}
      showLabel={showLabel ?? strings.showTable}
      hideLabel={hideLabel ?? strings.hideTable}
      className={className}
      style={style}
      caption={caption ?? table.caption()}
      head={
        <>
          <Table.Head scope="col">{xHeader ?? table.xHeader()}</Table.Head>
          {table.heads().map((head, column) => (
            // The columns never reorder within a model, so the position is their identity.
            <Table.Head key={column} scope="col">
              <Twin text={head} />
            </Table.Head>
          ))}
          <ChartTableRowContext value={{ kind: "header", table }}>{children}</ChartTableRowContext>
        </>
      }
      pages={{
        index,
        count: pages.length,
        status: strings.pageStatus(String(index + 1), String(pages.length), page.label),
        go,
      }}>
      {table.rows(page).map((row) => (
        <Table.Row key={row.key}>
          <Table.Head scope="row">
            <Twin text={row.head} />
          </Table.Head>
          {row.cells.map((cell) => (
            <BodyCell key={cell.key} cell={cell} />
          ))}
          <ChartTableRowContext value={{ kind: "row", slot: row.slot, table }}>
            {children}
          </ChartTableRowContext>
        </Table.Row>
      ))}
    </ChartTableShell>
  );
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
export function ChartTableColumn({
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

Object.assign(ChartTableBody, { displayName: "Chart.TableBody" });
Object.assign(ChartTableColumn, { displayName: "Chart.TableColumn" });
