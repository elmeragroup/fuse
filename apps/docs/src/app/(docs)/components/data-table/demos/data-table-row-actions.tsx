"use client";

import { useMemo, useState } from "react";

import { tableFeatures } from "@tanstack/react-table";

import { actionsColumn, createFuseTableHook } from "@elmeragroup/fuse/data-table";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

type Product = {
  readonly sku: string;
  readonly name: string;
  readonly stock: number;
};

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({}),
  getRowId: (product: Product) => product.sku,
});

const PRODUCTS: Product[] = [
  { sku: "FRN-001", name: "Ergonomic Desk Chair", stock: 124 },
  { sku: "AUD-042", name: "Wireless Headphones", stock: 8 },
  { sku: "ACC-033", name: "USB-C Docking Station", stock: 0 },
];

const columns = createAppColumnHelper<Product>();

// The row actions report through `onAction`, so the columns are built once per table.
function productColumns(onAction: (line: string) => void) {
  return columns.columns([
    columns.accessor("name", { header: "Product", cell: ({ cell }) => <cell.TextCell /> }),
    columns.accessor("stock", { header: "Stock", cell: ({ cell }) => <cell.NumberCell /> }),
    actionsColumn(columns, {
      getRowName: (product) => product.name,
      items: (product) => (
        <>
          <DropdownMenu.Item onClick={() => onAction(`Edited ${product.name}`)}>Edit</DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={product.stock > 0}
            onClick={() => onAction(`Restocked ${product.name}`)}>
            Restock
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item variant="destructive" onClick={() => onAction(`Archived ${product.name}`)}>
            Archive
          </DropdownMenu.Item>
        </>
      ),
    }),
  ]);
}

export function DataTableRowActions() {
  const [lastAction, setLastAction] = useState("");
  const productTable = useMemo(() => productColumns(setLastAction), []);
  const table = useFuseTable({ columns: productTable, data: PRODUCTS });

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <table.Content aria-label="Products" />
        <p role="status" className="text-sm text-muted-foreground">
          {lastAction}
        </p>
      </div>
    </table.AppTable>
  );
}
