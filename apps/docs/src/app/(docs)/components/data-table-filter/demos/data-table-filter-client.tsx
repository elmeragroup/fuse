"use client";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
} from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import {
  createDataTableFilterFn,
  DataTableFilter,
  defineFilterFields,
} from "@elmeragroup/fuse/data-table-filter";
import { Empty } from "@elmeragroup/fuse/empty";
import { CalendarBlank, Circle, ListChecks, Money, User } from "@elmeragroup/fuse/icons";

type Status = "draft" | "pending" | "paid" | "overdue";
type Tag = "priority" | "recurring" | "export";

type Order = {
  readonly id: string;
  readonly customer: string;
  readonly status: Status;
  readonly tags: readonly Tag[];
  readonly amount: number;
  readonly created: Date;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

const TAG_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "recurring", label: "Recurring" },
  { value: "export", label: "Export" },
] as const;

// A plain object per filterable column, keyed by column id and checked against the row type.
const ORDER_FILTERS = defineFilterFields<Order>()({
  customer: { kind: "text", label: "Customer", icon: <User /> },
  status: { kind: "option", label: "Status", icon: <Circle />, options: STATUS_OPTIONS, order: "count" },
  tags: { kind: "multiOption", label: "Tags", icon: <ListChecks />, options: TAG_OPTIONS },
  amount: {
    kind: "number",
    label: "Amount",
    icon: <Money />,
    format: { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
    step: 100,
  },
  created: { kind: "date", label: "Created", icon: <CalendarBlank /> },
});

// One time zone for every date comparison, the same one a server would use.
const dataTableFilter = createDataTableFilterFn({ timeZone: "Europe/Oslo" });

const { useAppTable: useOrdersTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    columnFacetingFeature,
    rowPaginationFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    facetedMinMaxValues: createFacetedMinMaxValues(),
    paginatedRowModel: createPaginatedRowModel(),
    filterFns: { dataTableFilter },
  }),
  defaultColumn: { filterFn: "dataTableFilter" },
  getRowId: (order: Order) => order.id,
});

const STATUS_LABELS = new Map<string, string>(STATUS_OPTIONS.map((option) => [option.value, option.label]));

const columns = createAppColumnHelper<Order>();
const COLUMNS = columns.columns([
  columns.accessor("id", {
    header: "Order",
    enableColumnFilter: false,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("status", { header: "Status", cell: ({ row }) => STATUS_LABELS.get(row.original.status) }),
  // Without getUniqueValues a row counts its whole array as one facet entry.
  columns.accessor("tags", {
    header: "Tags",
    getUniqueValues: (order) => [...order.tags],
    cell: ({ row }) => row.original.tags.join(", "),
  }),
  columns.accessor("amount", { header: "Amount", cell: ({ cell }) => <cell.CurrencyCell currency="NOK" /> }),
  columns.accessor("created", {
    header: "Created",
    cell: ({ cell }) => <cell.DateCell timeZone="Europe/Oslo" />,
  }),
]);

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris Sjømat", "Nordlys Kafé", "Bryggen Bokhandel"];
const STATUSES: readonly Status[] = ["paid", "pending", "paid", "overdue", "draft", "paid", "pending"];
const TAGS: readonly Tag[] = ["priority", "recurring", "export"];

// Module-level rows: TanStack rebuilds the row model whenever `data` changes identity.
const ORDERS: Order[] = Array.from({ length: 40 }, (_, index) => ({
  id: `ORD-${String(1001 + index)}`,
  customer: CUSTOMERS[(index * 3) % CUSTOMERS.length] ?? "Aurora Bakeri",
  status: STATUSES[index % STATUSES.length] ?? "paid",
  tags: TAGS.filter((_, tag) => (index + tag) % (tag + 3) === 0),
  amount: 250 + ((index * 3779) % 24_000),
  created: new Date(Date.UTC(2026, 6 + (index % 4), 1 + ((index * 7) % 28), 12)),
}));

export function DataTableFilterClient() {
  // Uncontrolled: TanStack keeps columnFilters. Pass state and onColumnFiltersChange to control it.
  const table = useOrdersTable({
    columns: COLUMNS,
    data: ORDERS,
    initialState: { pagination: { pageIndex: 0, pageSize: 8 } },
  });

  return (
    <table.AppTable>
      <DataTableFilter.Root table={table} fields={ORDER_FILTERS} timeZone="Europe/Oslo">
        <div className="flex w-full min-w-0 flex-col gap-4">
          <DataTableFilter.Bar aria-label="Order filters" />
          {/* Siblings of the Bar, never its children. */}
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <table.Content
            aria-label="Orders"
            empty={
              <Empty.Root>
                <Empty.Header>
                  <Empty.Title>No orders match</Empty.Title>
                </Empty.Header>
                <Empty.Content>
                  {/* Inside the Root and outside the Bar, Clear renders as a plain button. */}
                  <DataTableFilter.Clear />
                </Empty.Content>
              </Empty.Root>
            }
          />
          <table.Pagination />
        </div>
      </DataTableFilter.Root>
    </table.AppTable>
  );
}
