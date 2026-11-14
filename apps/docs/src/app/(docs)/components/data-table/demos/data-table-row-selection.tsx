"use client";

import { rowSelectionFeature, tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook, selectColumn } from "@elmeragroup/fuse/data-table";

type Customer = { readonly id: number; readonly name: string; readonly city: string };

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({ rowSelectionFeature }),
  getRowId: (customer: Customer) => String(customer.id),
});

const columns = createAppColumnHelper<Customer>();

const COLUMNS = columns.columns([
  selectColumn(columns, { getRowLabel: (customer) => `Select ${customer.name}` }),
  columns.accessor("name", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("city", { header: "City", cell: ({ cell }) => <cell.TextCell /> }),
]);

const CUSTOMERS: Customer[] = [
  { id: 4711, name: "Aurora Bakeri", city: "Tromsø" },
  { id: 4712, name: "Fjellstue AS", city: "Lillehammer" },
  { id: 4713, name: "Havbris", city: "Bergen" },
];

export function DataTableRowSelection() {
  const table = useFuseTable({ columns: COLUMNS, data: CUSTOMERS });
  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <table.Content aria-label="Customers" />
        <p className="text-sm text-muted-foreground">{table.getSelectedRowModel().rows.length} selected.</p>
      </div>
    </table.AppTable>
  );
}
