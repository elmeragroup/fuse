"use client";

/**
 * Metering points: a DataTable of all 480 points with a search box, a DataTableFilter bar over
 * price area, status, contract and annual use, sortable columns, pages, and row selection with a
 * bulk action. Each row carries a Sparkline of its last 30 days.
 *
 * The search is the table's global filter and the bar sets its column filters, so both narrow the
 * same rows and the bar's counts follow the search. Selection has one rule for every filter: the
 * bulk actions act on the selected points that pass the current filters. A selected point a filter
 * hides stays selected, out of the actions' reach, until a filter change shows it again; the toolbar
 * says how many are hidden, and Clear selection clears them too.
 */

import { useDeferredValue, useRef, useState } from "react";
import type { ReactElement } from "react";

import {
  columnFacetingFeature,
  columnFilteringFeature,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Sparkline } from "@elmeragroup/fuse/chart";
import { createFuseTableHook, selectColumn } from "@elmeragroup/fuse/data-table";
import {
  createDataTableFilterFn,
  DataTableFilter,
  defineFilterFields,
} from "@elmeragroup/fuse/data-table-filter";
import { Empty } from "@elmeragroup/fuse/empty";
import {
  Circle,
  Contract,
  Download,
  Lightning,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  X,
} from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Toast } from "@elmeragroup/fuse/toast";

import { APP_LOCALE } from "./app-config";
import { PageHeader } from "./page-header";
import {
  CONTRACT_LABELS,
  CONTRACT_TYPES,
  METERING_POINT_STATUSES,
  METERING_POINTS,
  PRICE_AREA_NAMES,
  PRICE_AREAS,
  STATUS_LABELS,
  TIME_ZONE,
} from "./power-data";
import type { MeteringPoint, MeteringPointStatus } from "./power-data";

const FILTERS = defineFilterFields<MeteringPoint>()({
  priceArea: {
    kind: "option",
    label: "Price area",
    icon: <MapPin />,
    options: PRICE_AREAS.map((area) => ({ value: area, label: `${area} ${PRICE_AREA_NAMES[area]}` })),
  },
  status: {
    kind: "option",
    label: "Status",
    icon: <Circle />,
    options: METERING_POINT_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    order: "count",
  },
  contract: {
    kind: "option",
    label: "Contract",
    icon: <Contract />,
    options: CONTRACT_TYPES.map((contract) => ({ value: contract, label: CONTRACT_LABELS[contract] })),
  },
  annualKwh: {
    kind: "number",
    label: "Annual use, kWh",
    icon: <Lightning />,
    format: { maximumFractionDigits: 0 },
    step: 500,
  },
});

// One time zone for every comparison, the market's, as a server would use.
const dataTableFilter = createDataTableFilterFn({ timeZone: TIME_ZONE });

const { useAppTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    columnFacetingFeature,
    globalFilteringFeature,
    rowSortingFeature,
    rowSelectionFeature,
    rowPaginationFeature,
    filteredRowModel: createFilteredRowModel(),
    facetedRowModel: createFacetedRowModel(),
    facetedUniqueValues: createFacetedUniqueValues(),
    facetedMinMaxValues: createFacetedMinMaxValues(),
    sortedRowModel: createSortedRowModel(),
    paginatedRowModel: createPaginatedRowModel(),
    filterFns: { dataTableFilter },
    sortFns,
  }),
  defaultColumn: { filterFn: "dataTableFilter" },
  getRowId: (point: MeteringPoint) => point.id,
});

/** Each status's badge: its label and its tone. */
const STATUS_BADGES = {
  active: { label: STATUS_LABELS.active, variant: "soft-success" },
  onboarding: { label: STATUS_LABELS.onboarding, variant: "soft-info" },
  "moving-out": { label: STATUS_LABELS["moving-out"], variant: "soft-warning" },
  disconnected: { label: STATUS_LABELS.disconnected, variant: "muted" },
} as const satisfies Record<MeteringPointStatus, { label: string; variant: string }>;

const KWH = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const columns = createAppColumnHelper<MeteringPoint>();

const COLUMNS = columns.columns([
  selectColumn(columns, { getRowLabel: (point) => `Select ${point.customer}, ${point.address}` }),
  columns.accessor("customer", {
    header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
    enableColumnFilter: false,
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col">
        <span className="font-medium truncate">{row.original.customer}</span>
        <span className="text-xs truncate text-muted-foreground">
          {row.original.address}, {row.original.city}
        </span>
      </span>
    ),
  }),
  columns.accessor("id", {
    header: "Metering point",
    enableColumnFilter: false,
    cell: ({ row }) => (
      <span className="text-xs font-mono text-muted-foreground tabular-nums">{row.original.id}</span>
    ),
  }),
  columns.accessor("priceArea", {
    header: ({ header }) => <header.SortButton>Area</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("status", {
    header: "Status",
    cell: ({ row }) => (
      <Badge size="sm" variant={STATUS_BADGES[row.original.status].variant}>
        {STATUS_BADGES[row.original.status].label}
      </Badge>
    ),
  }),
  columns.accessor("contract", {
    header: "Contract",
    cell: ({ row }) => CONTRACT_LABELS[row.original.contract],
  }),
  columns.accessor("annualKwh", {
    // Amounts line up on their last digit, so the header and the figures sit at the end.
    header: ({ header }) => (
      <span className="flex justify-end">
        <header.SortButton>Annual use (kWh)</header.SortButton>
      </span>
    ),
    cell: ({ cell }) => (
      <span className="block text-right">
        <cell.NumberCell maximumFractionDigits={0} />
      </span>
    ),
  }),
  columns.display({
    id: "last30Days",
    header: "Last 30 days",
    cell: ({ row }) => (
      <Sparkline
        aria-label={`Consumption per day, last 30 days, ${row.original.customer}`}
        data={row.original.last30Days}
        format={KWH}
        locale={APP_LOCALE}
        emphasis="last"
        className="h-7 w-28"
      />
    ),
  }),
]);

/** Whether a point's name, address, city or id holds every word of the search. */
function matchesSearch(point: MeteringPoint, words: readonly string[]): boolean {
  const haystack = `${point.customer} ${point.address} ${point.city} ${point.id}`.toLocaleLowerCase("nb-NO");
  return words.every((word) => haystack.includes(word));
}

function searchWords(query: string): readonly string[] {
  return query
    .trim()
    .toLocaleLowerCase("nb-NO")
    .split(/\s+/u)
    .filter((word) => word !== "");
}

/** A CSV file of the points, in the columns a spreadsheet wants, downloaded under `name`. */
function downloadCsv(points: readonly MeteringPoint[], name: string): void {
  const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = [
    ["Metering point", "Customer", "Address", "City", "Price area", "Status", "Contract", "Annual use (kWh)"],
    ...points.map((point) => [
      point.id,
      point.customer,
      point.address,
      point.city,
      point.priceArea,
      STATUS_LABELS[point.status],
      CONTRACT_LABELS[point.contract],
      point.annualKwh,
    ]),
  ];
  const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\r\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // The download has started once the click returns; the next task can let the file go.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString(APP_LOCALE)} ${count === 1 ? one : many}`;
}

/** The table's rows: one stable array, so TanStack never rebuilds its row models for a search. */
const POINTS = [...METERING_POINTS];

/** The metering points page. */
export function MeteringPointsPage(): ReactElement {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const toasts = Toast.useToastManager();
  const list = useRef<HTMLDivElement>(null);

  // Both bulk actions empty the visible selection, which takes the toolbar, or its enabled buttons,
  // away from under the focus. Focus moves first to the table's select-all checkbox, which stays.
  function focusSelectAll(): void {
    list.current?.querySelector<HTMLElement>('[data-slot="data-table-select-all"]')?.focus();
  }
  const table = useAppTable({
    columns: COLUMNS,
    // The whole portfolio, always: search and the bar filter it, so every point keeps its row and its
    // selection whatever hides it.
    data: POINTS,
    state: { globalFilter: deferredQuery },
    // Every column passes the row to one search over its name, address, city and GSRN.
    globalFilterFn: (row, _columnId, value) => matchesSearch(row.original, searchWords(String(value))),
    initialState: {
      pagination: { pageIndex: 0, pageSize: 25 },
      sorting: [{ id: "customer", desc: false }],
    },
  });
  const shown = table.getFilteredRowModel().rows.map((row) => row.original);
  // What the bulk actions act on: the selected points that pass the search and the bar's filters.
  const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original);
  const hidden = table.getSelectedRowModel().rows.length - selected.length;

  return (
    <>
      <PageHeader page="Metering points">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            downloadCsv(shown, "metering-points.csv");
          }}>
          <Download data-icon="inline-start" />
          Export {plural(shown.length, "point", "points")}
        </Button>
      </PageHeader>
      <table.AppTable>
        <DataTableFilter.Root table={table} fields={FILTERS} timeZone={TIME_ZONE}>
          <div ref={list} className="md:px-6 flex min-w-0 flex-col gap-3 px-4 pt-2 pb-8">
            {/* One row at every width: the search takes the room on a phone, the chips on desktop. */}
            <div className="flex items-center gap-2">
              <InputGroup.Root className="min-w-0 flex-2 min-[48rem]:w-72 min-[48rem]:flex-none">
                <InputGroup.Addon>
                  <MagnifyingGlass aria-hidden />
                </InputGroup.Addon>
                <InputGroup.Input
                  type="search"
                  aria-label="Search metering points"
                  placeholder="Name, address or metering point"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                />
              </InputGroup.Root>
              <DataTableFilter.Bar aria-label="Metering point filters" className="min-w-0 flex-1" />
            </div>
            <DataTableFilter.Content />
            <DataTableFilter.ValueContent />

            <p role="status" className="text-sm text-muted-foreground tabular-nums">
              {shown.length === METERING_POINTS.length
                ? plural(shown.length, "metering point", "metering points")
                : `${plural(shown.length, "metering point", "metering points")} of ${METERING_POINTS.length.toLocaleString(APP_LOCALE)}`}
            </p>

            <table.Content
              aria-label="Metering points"
              empty={
                <Empty.Root>
                  <Empty.Header>
                    <Empty.Media variant="icon">
                      <MagnifyingGlass />
                    </Empty.Media>
                    <Empty.Title>No metering points match</Empty.Title>
                    <Empty.Description>Try another name or address, or take a filter away.</Empty.Description>
                  </Empty.Header>
                  <Empty.Content>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        table.resetColumnFilters();
                      }}>
                      Clear search and filters
                    </Button>
                  </Empty.Content>
                </Empty.Root>
              }
            />
            {/* The bulk actions float at the foot of the table while rows are selected, so they stay in
                reach however far the list has scrolled. */}
            {selected.length + hidden === 0 ? null : (
              <div
                role="toolbar"
                aria-label="Selected metering points"
                className="text-sm shadow-lg sticky bottom-4 z-10 flex max-w-full flex-wrap items-center gap-2 self-center rounded-xl bg-popover py-2 ps-4 pe-2 text-popover-foreground ring-1 ring-border">
                <span role="status" className="me-2 tabular-nums">
                  <span className="font-medium">{plural(selected.length, "point", "points")} selected</span>
                  {hidden === 0 ? null : (
                    <span className="text-muted-foreground">
                      {" "}
                      · {plural(hidden, "more", "more")} hidden by filters
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  disabled={selected.length === 0}
                  onClick={() => {
                    toasts.add({
                      type: "success",
                      title: "Reading reminders sent",
                      description: `${plural(selected.length, "customer", "customers")} will get a reminder to read their meter.`,
                    });
                    // The points the action reached leave the selection; hidden ones stay for later.
                    const reached = new Set(selected.map((point) => point.id));
                    focusSelectAll();
                    table.setRowSelection((current) =>
                      Object.fromEntries(Object.entries(current).filter(([id]) => !reached.has(id)))
                    );
                  }}>
                  <PaperPlaneTilt data-icon="inline-start" />
                  Send reading reminder
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selected.length === 0}
                  onClick={() => {
                    downloadCsv(selected, "selected-metering-points.csv");
                  }}>
                  <Download data-icon="inline-start" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear selection"
                  onClick={() => {
                    focusSelectAll();
                    table.resetRowSelection();
                  }}>
                  <X />
                </Button>
              </div>
            )}
            <table.Pagination pageSizes={[10, 25, 50, 100]} />
          </div>
        </DataTableFilter.Root>
      </table.AppTable>
    </>
  );
}
