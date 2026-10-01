"use client";

import { useMemo, useState } from "react";

import {
  columnFilteringFeature,
  createFilteredRowModel,
  filterFns,
  tableFeatures,
} from "@tanstack/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { actionsColumn, createFuseTableHook } from "@elmeragroup/fuse/data-table";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Empty } from "@elmeragroup/fuse/empty";
import { MagnifyingGlass, Package } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Select } from "@elmeragroup/fuse/select";

type Product = {
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly stock: number;
  readonly price: number;
};

type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

// The app owns what a stock level means and how it looks.
function stockStatus(stock: number): StockStatus {
  if (stock >= 10) {
    return "in-stock";
  }
  return stock > 0 ? "low-stock" : "out-of-stock";
}

function StockBadge({ status }: { readonly status: StockStatus }) {
  switch (status) {
    case "in-stock":
      return <Badge variant="success">In Stock</Badge>;
    case "low-stock":
      return <Badge variant="warning">Low Stock</Badge>;
    case "out-of-stock":
      return <Badge variant="destructive">Out of Stock</Badge>;
  }
}

const STATUS_FILTERS = {
  all: "All statuses",
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
} as const;

type StatusFilter = keyof typeof STATUS_FILTERS;

const STATUS_ORDER: readonly StatusFilter[] = ["all", "in-stock", "low-stock", "out-of-stock"];

// An app cell: registered once, used by any column whose value is a stock count.
function StockCell() {
  const stock = useCellContext<number>().getValue();
  return (
    <span className="flex items-center gap-2">
      <StockBadge status={stockStatus(stock)} />
      <span className="text-muted-foreground tabular-nums">({stock})</span>
    </span>
  );
}

const {
  useAppTable: useFuseTable,
  createAppColumnHelper,
  useCellContext,
} = createFuseTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    filteredRowModel: createFilteredRowModel(),
    filterFns,
  }),
  getRowId: (product: Product) => product.sku,
  cellComponents: { StockCell },
});

const PRODUCTS: Product[] = [
  { sku: "FRN-001", name: "Ergonomic Desk Chair", category: "Furniture", stock: 124, price: 549 },
  { sku: "AUD-042", name: "Wireless Noise-Canceling Headphones", category: "Audio", stock: 8, price: 349.99 },
  { sku: "DSP-019", name: '4K Ultra HD Monitor 32"', category: "Displays", stock: 0, price: 799 },
  { sku: "INP-087", name: "Mechanical Keyboard RGB", category: "Input", stock: 56, price: 129 },
  { sku: "ACC-033", name: "USB-C Docking Station", category: "Accessories", stock: 3, price: 189 },
];

const columns = createAppColumnHelper<Product>();

// The row actions report through `onAction`, so the columns are built once per table.
function inventoryColumns(onAction: (line: string) => void) {
  return columns.columns([
    // One column filters on the name and the SKU together.
    columns.accessor((product) => `${product.name} ${product.sku}`, {
      id: "product",
      header: "Product",
      filterFn: "includesString",
      cell: ({ row }) => (
        <span className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Package aria-hidden />
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs font-mono text-muted-foreground">{row.original.sku}</span>
          </span>
        </span>
      ),
    }),
    columns.accessor("category", {
      header: "Category",
      cell: ({ cell }) => <cell.TextCell className="text-muted-foreground" />,
    }),
    columns.accessor("stock", {
      header: "Stock",
      filterFn: (row, _columnId, status: StatusFilter) => stockStatus(row.original.stock) === status,
      cell: ({ cell }) => <cell.StockCell />,
    }),
    columns.accessor("price", {
      header: () => <span className="block text-right">Price</span>,
      cell: ({ cell }) => <cell.CurrencyCell currency="USD" className="block text-right" />,
    }),
    actionsColumn(columns, {
      getRowName: (product) => product.name,
      items: (product) => (
        <>
          <DropdownMenu.Item onClick={() => onAction(`Edited ${product.name}`)}>Edit</DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={stockStatus(product.stock) === "in-stock"}
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

export function DataTableInventory() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [lastAction, setLastAction] = useState("");

  // The app owns the filter state; TanStack's filtered row model applies it.
  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(search === "" ? [] : [{ id: "product", value: search }]),
      ...(status === "all" ? [] : [{ id: "stock", value: status }]),
    ],
    [search, status]
  );

  const inventory = useMemo(() => inventoryColumns(setLastAction), []);
  const table = useFuseTable({
    columns: inventory,
    data: PRODUCTS,
    state: { columnFilters },
  });

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup.Root className="max-w-xs">
            <InputGroup.Addon>
              <MagnifyingGlass aria-hidden />
            </InputGroup.Addon>
            <InputGroup.Input
              aria-label="Search products"
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </InputGroup.Root>
          <Select.Root<StatusFilter>
            items={STATUS_FILTERS}
            value={status}
            onValueChange={(value) => {
              setStatus(value ?? "all");
            }}>
            <Select.Trigger aria-label="Stock status" className="w-40">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {STATUS_ORDER.map((value) => (
                <Select.Item key={value} value={value}>
                  {STATUS_FILTERS[value]}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </div>
        <table.Content
          aria-label="Inventory"
          empty={
            <Empty.Root>
              <Empty.Header>
                <Empty.Title>No products match</Empty.Title>
                <Empty.Description>Try another name, SKU or stock status.</Empty.Description>
              </Empty.Header>
              <Empty.Content>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                  }}>
                  Clear filters
                </Button>
              </Empty.Content>
            </Empty.Root>
          }
        />
        <p role="status" className="text-sm text-muted-foreground">
          {lastAction}
        </p>
      </div>
    </table.AppTable>
  );
}
