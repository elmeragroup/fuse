"use client";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createColumnHelper,
  createFilteredRowModel,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";

import {
  createDataTableFilterFn,
  DataTableFilter,
  defineFilterFields,
} from "@elmeragroup/fuse/data-table-filter";
import { Package, User } from "@elmeragroup/fuse/icons";

type Order = { readonly id: string; readonly customer: string; readonly product: string };

const MATERIALS = [
  "Oak",
  "Pine",
  "Birch",
  "Ash",
  "Walnut",
  "Steel",
  "Brass",
  "Linen",
  "Wool",
  "Cotton",
  "Glass",
  "Stone",
];
const ITEMS = [
  "shelf",
  "chair",
  "table",
  "lamp",
  "rug",
  "mirror",
  "stool",
  "bench",
  "desk",
  "cabinet",
  "vase",
  "bowl",
];
const ITEMS_MORE = [
  "tray",
  "basket",
  "hook",
  "rail",
  "frame",
  "clock",
  "throw",
  "cushion",
  "blanket",
  "planter",
  "candle",
  "holder",
  "box",
];
const SIZES = [20, 30, 40, 50, 60, 80, 100, 120, 160, 200];

// 12 materials × 25 items × 10 sizes: 3,000 products, all loaded on the client.
const PRODUCT_OPTIONS = MATERIALS.flatMap((material) =>
  [...ITEMS, ...ITEMS_MORE].flatMap((item) =>
    SIZES.map((size) => ({
      value: `${material.toLowerCase()}-${item}-${String(size)}`,
      label: `${material} ${item} ${String(size)} cm`,
    }))
  )
);

const ORDER_FILTERS = defineFilterFields<Order>()({
  customer: { kind: "text", label: "Customer", icon: <User /> },
  // Every list of values shows its first 50 matches and asks for more typing. Count order puts the
  // products that have orders first.
  product: { kind: "option", label: "Product", icon: <Package />, options: PRODUCT_OPTIONS, order: "count" },
});

// Select all, Clear all and Done under Product's list only, in the add menu and in the chip's
// popover alike. Select all picks every product, or every one the search matches, past the 50
// rows the list shows.
function ProductFooter() {
  return (
    <DataTableFilter.ValuesFooter fields={["product"]}>
      <DataTableFilter.SelectAllValues />
      <DataTableFilter.ClearValues />
      <DataTableFilter.Done />
    </DataTableFilter.ValuesFooter>
  );
}

function OrderEditor() {
  return (
    <DataTableFilter.Editor>
      <DataTableFilter.OptionEditor>
        <ProductFooter />
      </DataTableFilter.OptionEditor>
      <DataTableFilter.TextEditor />
    </DataTableFilter.Editor>
  );
}

const dataTableFilter = createDataTableFilterFn();

const features = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  filterFns: { dataTableFilter },
});

const columns = createColumnHelper<typeof features, Order>();
// In client mode TanStack filters only the ids that are columns, so each field needs one.
const COLUMNS = columns.columns([columns.accessor("customer", {}), columns.accessor("product", {})]);

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris Sjømat", "Nordlys Kafé", "Bryggen Bokhandel"];

const ORDERS: Order[] = Array.from({ length: 200 }, (_, index) => ({
  id: `ORD-${String(3001 + index)}`,
  customer: CUSTOMERS[index % CUSTOMERS.length] ?? "Aurora Bakeri",
  product: PRODUCT_OPTIONS[(index * 389) % PRODUCT_OPTIONS.length]?.value ?? "oak-shelf-20",
}));

// The demo opens filtered to the first three orders' products, so the Product chip's popover
// shows the footer from the start.
const INITIAL_FILTERS = [
  {
    id: "product",
    value: { kind: "option", operator: "isAnyOf", values: ORDERS.slice(0, 3).map((order) => order.product) },
  },
];

export function DataTableFilterHighCardinality() {
  const table = useTable({
    features,
    columns: COLUMNS,
    data: ORDERS,
    defaultColumn: { filterFn: "dataTableFilter" },
    getRowId: (order) => order.id,
    initialState: { columnFilters: INITIAL_FILTERS },
  });

  return (
    <DataTableFilter.Root table={table} fields={ORDER_FILTERS}>
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DataTableFilter.Bar aria-label="Order filters" />
        <DataTableFilter.Content>
          <DataTableFilter.FieldList>
            <ProductFooter />
          </DataTableFilter.FieldList>
          <OrderEditor />
        </DataTableFilter.Content>
        <DataTableFilter.ValueContent>
          <OrderEditor />
        </DataTableFilter.ValueContent>
        <output className="text-sm text-muted-foreground tabular-nums">
          {table.getRowModel().rows.length} of {ORDERS.length} orders
        </output>
      </div>
    </DataTableFilter.Root>
  );
}
