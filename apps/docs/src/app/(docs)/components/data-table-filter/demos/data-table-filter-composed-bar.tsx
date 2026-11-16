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
import { CalendarBlank, Circle } from "@elmeragroup/fuse/icons";

type Status = "pending" | "paid" | "overdue";

type Order = { readonly id: string; readonly status: Status; readonly created: Date };

const ORDER_FILTERS = defineFilterFields<Order>()({
  status: {
    kind: "option",
    label: "Status",
    icon: <Circle />,
    options: [
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "overdue", label: "Overdue" },
    ],
  },
  created: {
    kind: "date",
    label: "Created",
    icon: <CalendarBlank />,
    presets: ["today", "yesterday", "thisWeek", "lastWeek", "thisMonth", "lastMonth"],
  },
});

const dataTableFilter = createDataTableFilterFn({ timeZone: "Europe/Oslo" });

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
const COLUMNS = columns.columns([columns.accessor("status", {}), columns.accessor("created", {})]);

const STATUSES: readonly Status[] = ["paid", "pending", "overdue"];

const ORDERS: Order[] = Array.from({ length: 12 }, (_, index) => ({
  id: `ORD-${String(4001 + index)}`,
  status: STATUSES[index % STATUSES.length] ?? "paid",
  created: new Date(Date.UTC(2026, 9, 1 + index * 2, 12)),
}));

export function DataTableFilterComposedBar() {
  const table = useTable({
    features,
    columns: COLUMNS,
    data: ORDERS,
    defaultColumn: { filterFn: "dataTableFilter" },
    getRowId: (order) => order.id,
    // One filter on first paint, so the chip template shows.
    initialState: {
      columnFilters: [{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }],
    },
  });

  return (
    <DataTableFilter.Root table={table} fields={ORDER_FILTERS} timeZone="Europe/Oslo">
      <div className="flex w-full min-w-0 flex-col gap-4">
        {/* The Bar written out, with a chip template that leaves out the Operator. */}
        <DataTableFilter.Bar aria-label="Order filters">
          <DataTableFilter.Trigger />
          <DataTableFilter.Chips>
            <DataTableFilter.Chip>
              <DataTableFilter.Subject />
              <DataTableFilter.Value />
              <DataTableFilter.Remove />
            </DataTableFilter.Chip>
          </DataTableFilter.Chips>
          <DataTableFilter.Clear />
        </DataTableFilter.Bar>
        <DataTableFilter.Content />
        <DataTableFilter.ValueContent />
        <output className="text-sm text-muted-foreground tabular-nums">
          {table.getRowModel().rows.length} of {ORDERS.length} orders
        </output>
      </div>
    </DataTableFilter.Root>
  );
}
