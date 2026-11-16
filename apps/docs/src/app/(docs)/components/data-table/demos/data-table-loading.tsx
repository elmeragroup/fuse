"use client";

import { tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Invoice = {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
};

// A stable empty list while the rows load: TanStack rebuilds the row model whenever `data` changes identity.
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

export function DataTableLoading() {
  const table = useFuseTable({ columns: COLUMNS, data: NO_INVOICES });
  return (
    <table.AppTable>
      <table.Content aria-label="Invoices" loading />
    </table.AppTable>
  );
}
