"use client";

/**
 * The table every chart family shares: a "Vis som tabell" button and the chart's data as a table,
 * paged in the shell's pagination, with each TableColumn rendered in the header row and in each
 * body row. The family's Table part hands it the table model, so a route that renders no Table
 * ships no family's rows. TableColumn, the extra column every family's Table takes, lives in
 * `chart-table-column.tsx`, so a route with no TableColumn ships no time formatting.
 */
import { createContext, Fragment, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { Table } from "../table/table";
import { useChartReadout } from "./chart-readout";
import type { ChartTableCell, ChartTableModel } from "./chart-readout-port";
import { ChartTableShell, Twin, useTableDisclosure } from "./chart-table-shell";
import type { ChartLayerProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";

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
  /**
   * Replaces the dictionary's "Vis som tabell". The button shows the table and moves focus to it.
   * While collapsed the table stays out of the Tab order and stays in the accessibility tree. Past
   * 500 rows it pages, by calendar period on a time axis, so a year of hours reads
   * as 53 ISO weeks, and by 500 rows otherwise.
   */
  showLabel?: string;
  /** Replaces the dictionary's "Skjul tabell". */
  hideLabel?: string;
  /** Extra columns as `TableColumn` parts, after the series and total columns. */
  children?: ReactNode;
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

Object.assign(ChartTableBody, { displayName: "Chart.TableBody" });
