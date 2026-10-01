"use client";

import type { ReactElement } from "react";

import { tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook, NumberCell } from "@elmeragroup/fuse/data-table";
import type { NumberCellProps } from "@elmeragroup/fuse/data-table";

type Contract = { readonly name: string; readonly price: number; readonly renews: Date };

const DAY = 24 * 60 * 60 * 1000;
const TODAY = Date.UTC(2026, 8, 30);

/** A tweak: Fuse's NumberCell with a default of its own. The props stay Fuse's. */
function WholeNumberCell(props: NumberCellProps): ReactElement {
  return <NumberCell maximumFractionDigits={0} {...props} />;
}

/** A replacement: the app's own DateCell. Fuse's `dateStyle` prop no longer exists on it. */
function RenewsInCell({ unit }: { readonly unit: "days" | "weeks" }): ReactElement {
  const renews = useCellContext<Date>().getValue();
  const days = Math.round((renews.getTime() - TODAY) / DAY);
  return (
    <span>{unit === "days" ? `in ${String(days)} days` : `in ${String(Math.round(days / 7))} weeks`}</span>
  );
}

const {
  useAppTable: useFuseTable,
  createAppColumnHelper,
  useCellContext,
} = createFuseTableHook({
  features: tableFeatures({}),
  cellComponents: { NumberCell: WholeNumberCell, DateCell: RenewsInCell },
});

const columns = createAppColumnHelper<Contract>();

const COLUMNS = columns.columns([
  columns.accessor("name", { header: "Contract", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("price", { header: "Price per kWh (øre)", cell: ({ cell }) => <cell.NumberCell /> }),
  columns.accessor("renews", { header: "Renews", cell: ({ cell }) => <cell.DateCell unit="weeks" /> }),
]);

const CONTRACTS: Contract[] = [
  { name: "Spot", price: 94.37, renews: new Date(TODAY + 12 * DAY) },
  { name: "Fixed 12 months", price: 118.9, renews: new Date(TODAY + 190 * DAY) },
  { name: "Fixed 36 months", price: 104.25, renews: new Date(TODAY + 820 * DAY) },
];

export function DataTableCellOverride() {
  const table = useFuseTable({ columns: COLUMNS, data: CONTRACTS });
  return (
    <table.AppTable>
      <table.Content aria-label="Contracts" />
    </table.AppTable>
  );
}
