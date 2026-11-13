"use client";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  tableFeatures,
} from "@tanstack/react-table";

import { Calendar } from "@elmeragroup/fuse/calendar";
import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import {
  createDataTableFilterFn,
  DataTableFilter,
  defineFilterFields,
} from "@elmeragroup/fuse/data-table-filter";
import type { DateEditorState } from "@elmeragroup/fuse/data-table-filter";
import { CalendarBlank, Circle } from "@elmeragroup/fuse/icons";
import { RangeCalendar } from "@elmeragroup/fuse/range-calendar";

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

const { useAppTable: useOrdersTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    columnFacetingFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    filterFns: { dataTableFilter },
  }),
  defaultColumn: { filterFn: "dataTableFilter" },
  getRowId: (order: Order) => order.id,
});

const columns = createAppColumnHelper<Order>();
const COLUMNS = columns.columns([
  columns.accessor("id", {
    header: "Order",
    enableColumnFilter: false,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("status", { header: "Status", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("created", {
    header: "Created",
    cell: ({ cell }) => <cell.DateCell timeZone="Europe/Oslo" />,
  }),
]);

const STATUSES: readonly Status[] = ["paid", "pending", "overdue"];

const ORDERS: Order[] = Array.from({ length: 12 }, (_, index) => ({
  id: `ORD-${String(4001 + index)}`,
  status: STATUSES[index % STATUSES.length] ?? "paid",
  created: new Date(Date.UTC(2026, 9, 1 + index * 2, 12)),
}));

/**
 * App code: a calendar in the date editor's slot. The editor's values are ISO dates, so the
 * calendars read them as `Temporal.PlainDate`s and hand back their ISO text.
 */
function OrderDateCalendar({ field, target, values, onValueChange }: DateEditorState) {
  const [start, end] = values;
  if (target === "range") {
    return (
      <RangeCalendar.Root
        aria-label={field.label}
        value={
          start !== undefined && end !== undefined
            ? { start: Temporal.PlainDate.from(start), end: Temporal.PlainDate.from(end) }
            : null
        }
        onValueChange={(range) => {
          onValueChange([range.start.toString(), range.end.toString()]);
        }}>
        <RangeCalendar.Header>
          <RangeCalendar.DecrementMonth />
          <RangeCalendar.VisibleRangeHeading />
          <RangeCalendar.IncrementMonth />
        </RangeCalendar.Header>
        <RangeCalendar.Months />
      </RangeCalendar.Root>
    );
  }
  return (
    <Calendar.Root
      aria-label={field.label}
      value={start === undefined ? null : Temporal.PlainDate.from(start)}
      onValueChange={(day) => {
        onValueChange([day.toString()]);
      }}>
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months />
    </Calendar.Root>
  );
}

/** One composition of the kind editors serves the add menu and the value popover. */
function OrderEditor() {
  return (
    <DataTableFilter.Editor>
      <DataTableFilter.OptionEditor />
      <DataTableFilter.DateEditor>{(editor) => <OrderDateCalendar {...editor} />}</DataTableFilter.DateEditor>
    </DataTableFilter.Editor>
  );
}

export function DataTableFilterCalendar() {
  const table = useOrdersTable({ columns: COLUMNS, data: ORDERS });

  return (
    <table.AppTable>
      <DataTableFilter.Root table={table} fields={ORDER_FILTERS} timeZone="Europe/Oslo">
        <div className="flex w-full min-w-0 flex-col gap-4">
          {/* The default Bar, written out. */}
          <DataTableFilter.Bar aria-label="Order filters">
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              <DataTableFilter.Chip>
                <DataTableFilter.Subject />
                <DataTableFilter.Operator />
                <DataTableFilter.Value />
                <DataTableFilter.Remove />
              </DataTableFilter.Chip>
            </DataTableFilter.Chips>
            <DataTableFilter.Clear />
          </DataTableFilter.Bar>
          <DataTableFilter.Content>
            <DataTableFilter.FieldList />
            <OrderEditor />
          </DataTableFilter.Content>
          <DataTableFilter.ValueContent>
            <OrderEditor />
          </DataTableFilter.ValueContent>
          <table.Content aria-label="Orders" />
        </div>
      </DataTableFilter.Root>
    </table.AppTable>
  );
}
