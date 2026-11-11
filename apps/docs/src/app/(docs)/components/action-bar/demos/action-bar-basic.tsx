"use client";

import { useState } from "react";

import { rowSelectionFeature, tableFeatures } from "@tanstack/react-table";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { createFuseTableHook, selectColumn } from "@elmeragroup/fuse/data-table";
import { Download, Trash } from "@elmeragroup/fuse/icons";

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
  { id: 4714, name: "Nordlys Kafé", city: "Bodø" },
];

export function ActionBarBasic() {
  const [customers, setCustomers] = useState(CUSTOMERS);
  const [exported, setExported] = useState<string | undefined>(undefined);
  const table = useFuseTable({ columns: COLUMNS, data: customers });
  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <table.AppTable>
      {/* The bar floats at the bottom of its nearest positioned ancestor. */}
      <div className="relative flex min-h-80 flex-col gap-4">
        <table.Content aria-label="Customers" />
        <p className="text-sm text-muted-foreground">{exported ?? "Select customers to act on them."}</p>
        <ActionBar.Root count={selected.length}>
          <ActionBar.Count />
          <ActionBar.Clear
            onClick={() => {
              table.resetRowSelection();
            }}
          />
          <ActionBar.Separator />
          <ActionBar.Button
            onClick={() => {
              setExported(`Exported ${selected.map((customer) => customer.name).join(", ")}.`);
            }}>
            <Download data-icon="inline-start" />
            <ActionBar.ButtonLabel>Export</ActionBar.ButtonLabel>
          </ActionBar.Button>
          <ActionBar.Button
            onClick={() => {
              setCustomers(customers.filter((customer) => !selected.includes(customer)));
              table.resetRowSelection();
            }}>
            <Trash data-icon="inline-start" />
            <ActionBar.ButtonLabel>Delete</ActionBar.ButtonLabel>
          </ActionBar.Button>
        </ActionBar.Root>
      </div>
    </table.AppTable>
  );
}
