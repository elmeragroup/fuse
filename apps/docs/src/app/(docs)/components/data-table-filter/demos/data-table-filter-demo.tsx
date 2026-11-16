"use client";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedMinMaxValues,
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
import { CalendarBlank, Circle, ListChecks, Money, Receipt, User } from "@elmeragroup/fuse/icons";

type Status = "draft" | "pending" | "paid" | "overdue";
type Tag = "priority" | "recurring" | "export";

type Order = {
  readonly id: string;
  readonly customer: string;
  readonly status: Status;
  readonly tags: readonly Tag[];
  readonly amount: number;
  readonly created: Date;
  readonly invoiced: boolean;
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
  invoiced: { kind: "boolean", label: "Invoiced", icon: <Receipt /> },
});

// One time zone for every date comparison, the same one a server would use.
const dataTableFilter = createDataTableFilterFn({ timeZone: "Europe/Oslo" });

const features = tableFeatures({
  columnFilteringFeature,
  columnFacetingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
  filterFns: { dataTableFilter },
});

const columns = createColumnHelper<typeof features, Order>();
// In client mode TanStack filters only the ids that are columns, so each field needs one.
const COLUMNS = columns.columns([
  columns.accessor("customer", {}),
  columns.accessor("status", {}),
  // Without getUniqueValues a row counts its whole array as one facet entry.
  columns.accessor("tags", { getUniqueValues: (order) => [...order.tags] }),
  columns.accessor("amount", {}),
  columns.accessor("created", {}),
  columns.accessor("invoiced", {}),
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
  invoiced: index % 3 !== 1,
}));

export function DataTableFilterDemo() {
  // Uncontrolled: TanStack keeps columnFilters. Pass state and onColumnFiltersChange to control it.
  const table = useTable({
    features,
    columns: COLUMNS,
    data: ORDERS,
    defaultColumn: { filterFn: "dataTableFilter" },
    getRowId: (order) => order.id,
  });
  const matching = table.getRowModel().rows.length;

  return (
    <DataTableFilter.Root table={table} fields={ORDER_FILTERS} timeZone="Europe/Oslo">
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DataTableFilter.Bar aria-label="Order filters" />
        {/* Siblings of the Bar, never its children. */}
        <DataTableFilter.Content />
        <DataTableFilter.ValueContent />
        <div className="flex items-center gap-3">
          <output className="text-sm text-muted-foreground tabular-nums">
            {matching} of {ORDERS.length} orders
          </output>
          {/* Inside the Root and outside the Bar, Clear renders as a plain button. */}
          {matching === 0 && <DataTableFilter.Clear />}
        </div>
      </div>
    </DataTableFilter.Root>
  );
}
