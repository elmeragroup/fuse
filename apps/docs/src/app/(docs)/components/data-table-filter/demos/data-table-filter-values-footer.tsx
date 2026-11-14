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

/** One footer serves the add menu's submenu and the chip's popover. */
function StatusFooter() {
  return (
    <DataTableFilter.ValuesFooter fields={["status"]}>
      <DataTableFilter.SelectAllValues />
      <DataTableFilter.ClearValues />
      <DataTableFilter.Done />
    </DataTableFilter.ValuesFooter>
  );
}

export function DataTableFilterValuesFooter() {
  const table = useTable({
    features,
    columns: COLUMNS,
    data: ORDERS,
    defaultColumn: { filterFn: "dataTableFilter" },
    getRowId: (order) => order.id,
  });

  return (
    <DataTableFilter.Root table={table} fields={ORDER_FILTERS} timeZone="Europe/Oslo">
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DataTableFilter.Bar aria-label="Order filters" />
        <DataTableFilter.Content>
          <DataTableFilter.FieldList>
            <StatusFooter />
          </DataTableFilter.FieldList>
          <DataTableFilter.Editor>
            <DataTableFilter.DateEditor />
          </DataTableFilter.Editor>
        </DataTableFilter.Content>
        <DataTableFilter.ValueContent>
          <DataTableFilter.Editor>
            <DataTableFilter.OptionEditor>
              <StatusFooter />
            </DataTableFilter.OptionEditor>
            <DataTableFilter.DateEditor />
          </DataTableFilter.Editor>
        </DataTableFilter.ValueContent>
        <output className="text-sm text-muted-foreground tabular-nums">
          {table.getRowModel().rows.length} of {ORDERS.length} orders
        </output>
      </div>
    </DataTableFilter.Root>
  );
}
