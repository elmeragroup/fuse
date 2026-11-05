"use client";

import { useMemo } from "react";
import type { ReactElement } from "react";

import { useChartRoot } from "./chart-context";
import { seriesTable } from "./chart-series-readout";
import { ChartTableBody } from "./chart-table-body";
import type { ChartTableProps } from "./chart-table-body";

/**
 * A "Vis som tabell" button and the chart's data as a table, which stays in the accessibility tree
 * while it is visually collapsed. The table lists every slot of the full data, pages past 500 rows
 * by calendar period, and carries one column per series and per multi-series stack total. Its
 * `TableColumn` children render once in the header row and once in each body row.
 *
 * @beta
 */
export function ChartTable(props: ChartTableProps): ReactElement {
  const context = useChartRoot("Chart.Table");
  const table = useMemo(() => seriesTable(context, context.update.keys), [context]);
  return <ChartTableBody table={table} {...props} />;
}

Object.assign(ChartTable, { displayName: "Chart.Table" });

export { ChartTableColumn } from "./chart-table-body";
export type { ChartTableColumnProps, ChartTableProps } from "./chart-table-body";
