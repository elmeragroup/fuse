"use client";

import { useState } from "react";

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
  columns.accessor("name", {
    header: "Customer",
    // The primary action is a real link, so keyboard users reach what a row click does.
    cell: ({ row }) => (
      <a
        href={`#customer-${String(row.original.id)}`}
        className="font-medium underline-offset-4 hover:underline">
        {row.original.name}
      </a>
    ),
  }),
  columns.accessor("city", { header: "City", cell: ({ cell }) => <cell.TextCell /> }),
]);

const CUSTOMERS: Customer[] = [
  { id: 4711, name: "Aurora Bakeri", city: "Tromsø" },
  { id: 4712, name: "Fjellstue AS", city: "Lillehammer" },
  { id: 4713, name: "Havbris", city: "Bergen" },
];

export function DataTableSelection() {
  const [opened, setOpened] = useState<string | undefined>(undefined);
  const table = useFuseTable({ columns: COLUMNS, data: CUSTOMERS });

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <table.Content aria-label="Customers">
          {(row) => (
            <table.Row
              row={row}
              onPress={() => {
                setOpened(row.original.name);
              }}
            />
          )}
        </table.Content>
        <p className="text-sm text-muted-foreground">
          {opened === undefined ? "Click a row to open it." : `Opened ${opened}.`}{" "}
          {table.getSelectedRowModel().rows.length} selected.
        </p>
      </div>
    </table.AppTable>
  );
}
