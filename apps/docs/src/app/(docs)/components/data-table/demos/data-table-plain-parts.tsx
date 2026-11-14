"use client";

import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";

import { DataTable } from "@elmeragroup/fuse/data-table";

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

const features = tableFeatures({});

const columns = createColumnHelper<typeof features, Invoice>();

// The plain parts take the table, row or value explicitly, from TanStack's own `useTable`.
const COLUMNS = columns.columns([
  columns.accessor("id", { header: "Invoice", cell: (info) => <DataTable.Text value={info.getValue()} /> }),
  columns.accessor("customer", {
    header: "Customer",
    cell: (info) => <DataTable.Text value={info.getValue()} />,
  }),
  columns.accessor("amount", {
    header: "Amount",
    cell: (info) => <DataTable.Currency value={info.getValue()} currency="NOK" />,
  }),
]);

export function DataTablePlainParts() {
  const table = useTable({ features, columns: COLUMNS, data: INVOICES });
  return <DataTable.Content table={table} aria-label="Invoices" />;
}
