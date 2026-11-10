"use client";

/**
 * The item families' Table parts: a pie's and a radial chart's categories unfolded, with their value
 * and share or maximum. The series families' Tables live in `polar-series-table.tsx`, so neither
 * family's route ships the other's table builder.
 */
import { useMemo } from "react";
import type { ReactElement } from "react";

import { usePolarContext } from "./chart-polar-context";
import type { ChartTableModel } from "./chart-readout-port";
import { ChartTableBody } from "./chart-table-body";
import type { ChartTableProps } from "./chart-table-body";
import { itemTable } from "./polar-item-table";

/**
 * The item table of a pie's or a radial chart's model, built once per model, as the cartesian Table
 * builds its own.
 *
 * @throws When the model holds series, a defect: `usePolarContext` admits the part under an item
 *   family only.
 */
function useItemTable(part: string, family: "pie" | "radial"): ChartTableModel {
  const { table } = usePolarContext(part, [family]).model;
  return useMemo(() => {
    if (table.kind !== "items") throw new Error(`${part} read a series table, which lists no items.`);
    return itemTable(table.source, table.shares);
  }, [part, table]);
}

/**
 * A "Vis som tabell" button and the pie's rows as a table, every category unfolded with its value
 * and its share, which stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function PieChartTable(props: ChartTableProps): ReactElement {
  return <ChartTableBody table={useItemTable("PieChart.Table", "pie")} {...props} />;
}

/**
 * A "Vis som tabell" button and the rings as a table, one row per ring with its value and its
 * maximum, which stays in the accessibility tree while it is visually collapsed.
 *
 * @beta
 */
export function RadialChartTable(props: ChartTableProps): ReactElement {
  return <ChartTableBody table={useItemTable("RadialChart.Table", "radial")} {...props} />;
}

Object.assign(PieChartTable, { displayName: "PieChart.Table" });
Object.assign(RadialChartTable, { displayName: "RadialChart.Table" });
