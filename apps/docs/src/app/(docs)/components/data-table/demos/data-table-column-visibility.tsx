"use client";

import { columnVisibilityFeature, tableFeatures } from "@tanstack/react-table";

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
  features: tableFeatures({ columnVisibilityFeature }),
  getRowId: (invoice: Invoice) => invoice.id,
});

const columns = createAppColumnHelper<Invoice>();

const COLUMN_LABELS = new Map([
  ["customer", "Customer"],
  ["amount", "Amount"],
]);

const COLUMNS = columns.columns([
  columns.accessor("id", { header: "Invoice", enableHiding: false, cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("amount", { header: "Amount", cell: ({ cell }) => <cell.CurrencyCell currency="NOK" /> }),
]);

export function DataTableColumnVisibility() {
  const table = useFuseTable({ columns: COLUMNS, data: INVOICES });
  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <table.ColumnToggle getLabel={(column) => COLUMN_LABELS.get(column.id) ?? column.id} />
        </div>
        <table.Content aria-label="Invoices" />
      </div>
    </table.AppTable>
  );
}
