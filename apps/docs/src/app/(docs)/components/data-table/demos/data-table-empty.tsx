"use client";

import { tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Invoice = {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
};

// No invoices match, so the table shows its empty row.
const NO_INVOICES: Invoice[] = [];

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({}),
  getRowId: (invoice: Invoice) => invoice.id,
});

const columns = createAppColumnHelper<Invoice>();

const COLUMNS = columns.columns([
  columns.accessor("id", { header: "Invoice", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("amount", { header: "Amount", cell: ({ cell }) => <cell.CurrencyCell currency="NOK" /> }),
]);

export function DataTableEmpty() {
  const table = useFuseTable({ columns: COLUMNS, data: NO_INVOICES });
  return (
    <table.AppTable>
      <table.Content aria-label="Invoices" empty="No invoices this month." />
    </table.AppTable>
  );
}
