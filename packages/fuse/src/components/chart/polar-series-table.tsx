"use client";

/**
 * The series families' Table parts: a radar's categories and a clock's slots, one column per series.
 * They live apart from the item families' Tables, so neither family's route ships the other's table
 * builder.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";

import { usePolarContext } from "./chart-polar-context";
import type { ChartTableModel } from "./chart-readout-port";
import { seriesTable } from "./chart-series-readout";
import { ChartTableBody } from "./chart-table-body";
import type { ChartTableProps } from "./chart-table-body";

/**
 * The series table of a radar's or a clock's model, built once per model.
 *
 * @throws When the model holds items, a defect: `usePolarContext` admits the part under a series
 *   family only.
 */
function useSeriesTable(part: string, family: "radar" | "clock"): ChartTableModel {
  const { table } = usePolarContext(part, [family]).model;
  return useMemo(() => {
    if (table.kind !== "series") throw new Error(`${part} read an item table, which lists no series.`);
    return seriesTable(table.context, table.keys);
  }, [part, table]);
}

/**
 * A "Vis som tabell" button and the radar's categories as a table, one column per series, which
 * stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function RadarChartTable(props: ChartTableProps): ReactElement {
  return <ChartTableBody table={useSeriesTable("RadarChart.Table", "radar")} {...props} />;
}

/**
 * A "Vis som tabell" button and the cycle's slots as a table, one column per series and per stack
 * total, which stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function ClockChartTable(props: ChartTableProps): ReactElement {
  return <ChartTableBody table={useSeriesTable("ClockChart.Table", "clock")} {...props} />;
}

Object.assign(RadarChartTable, { displayName: "RadarChart.Table" });
Object.assign(ClockChartTable, { displayName: "ClockChart.Table" });
