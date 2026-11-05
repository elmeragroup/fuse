"use client";

/**
 * The polar families' Table parts. Each is the shared table over its Root's own rows: a pie's and a
 * radial chart's categories unfolded, with their value and share or maximum, and a radar's
 * categories with one column per series.
 */
import type { ReactElement } from "react";

import { usePolarContext } from "./chart-polar-context";
import { ChartTableBody } from "./chart-table-body";
import type { ChartTableProps } from "./chart-table-body";

/**
 * A "Vis som tabell" button and the pie's rows as a table, every category unfolded with its value
 * and its share, which stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function PieChartTable(props: ChartTableProps): ReactElement {
  const { model } = usePolarContext("PieChart.Table", ["pie"]);
  return <ChartTableBody table={model.table} {...props} />;
}

/**
 * A "Vis som tabell" button and the rings as a table, one row per ring with its value and its
 * maximum, which stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function RadialChartTable(props: ChartTableProps): ReactElement {
  const { model } = usePolarContext("RadialChart.Table", ["radial"]);
  return <ChartTableBody table={model.table} {...props} />;
}

/**
 * A "Vis som tabell" button and the radar's categories as a table, one column per series, which
 * stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function RadarChartTable(props: ChartTableProps): ReactElement {
  const { model } = usePolarContext("RadarChart.Table", ["radar"]);
  return <ChartTableBody table={model.table} {...props} />;
}

/**
 * A "Vis som tabell" button and the cycle's slots as a table, one column per series and per stack
 * total, which stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function ClockChartTable(props: ChartTableProps): ReactElement {
  const { model } = usePolarContext("ClockChart.Table", ["clock"]);
  return <ChartTableBody table={model.table} {...props} />;
}

Object.assign(PieChartTable, { displayName: "PieChart.Table" });
Object.assign(RadialChartTable, { displayName: "RadialChart.Table" });
Object.assign(RadarChartTable, { displayName: "RadarChart.Table" });
Object.assign(ClockChartTable, { displayName: "ClockChart.Table" });
