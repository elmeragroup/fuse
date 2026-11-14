"use client";

import { tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Invoice = {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
};

const INVOICES: Invoice[] = [
  { id: "INV-1001", customer: "Aurora Bakeri", amount: 1240 },
  { id: "INV-1002", customer: "Fjellstue AS", amount: 890 },
  { id: "INV-1003", customer: "Havbris", amount: 2110 },
];

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

export function DataTableDemo() {
  const table = useFuseTable({ columns: COLUMNS, data: INVOICES });
  return (
    <table.AppTable>
      <table.Content aria-label="Invoices" />
    </table.AppTable>
  );
}
