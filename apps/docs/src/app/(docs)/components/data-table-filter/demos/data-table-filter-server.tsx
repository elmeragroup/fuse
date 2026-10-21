"use client";

import { useEffect, useState } from "react";

import { columnFilteringFeature, rowPaginationFeature, tableFeatures } from "@tanstack/react-table";
import type { ColumnFiltersState, PaginationState } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";
import {
  DataTableFilter,
  defineFilterFields,
  matchesFilter,
  parseColumnFilters,
} from "@elmeragroup/fuse/data-table-filter";
import type { FilterFacets } from "@elmeragroup/fuse/data-table-filter";
import { Circle, CurrencyCircleDollar, Money, User } from "@elmeragroup/fuse/icons";

type Status = "draft" | "pending" | "paid" | "overdue";

type Order = {
  readonly id: string;
  readonly customer: string;
  readonly status: Status;
  readonly amount: number;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
] as const;

// Server-safe: the same map parses the request on the server and drives the bar on the client.
const ORDER_FILTERS = defineFilterFields<Order>()({
  customer: { kind: "text", label: "Customer", icon: <User /> },
  status: { kind: "option", label: "Status", icon: <Circle />, options: STATUS_OPTIONS },
  amount: {
    kind: "number",
    label: "Amount",
    icon: <Money />,
    format: { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
    step: 100,
  },
  // A toggle's id need not be a column, because the server gives it meaning: see cellOf.
  large: { kind: "boolean", label: "Large orders only", icon: <CurrencyCircleDollar />, toggle: true },
});

const STATUS_LABELS = new Map<string, string>(STATUS_OPTIONS.map((option) => [option.value, option.label]));

type OrderPage = {
  readonly rows: Order[];
  readonly pageCount: number;
  readonly facets: FilterFacets<typeof ORDER_FILTERS>;
};

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris Sjømat", "Nordlys Kafé", "Bryggen Bokhandel"];
const STATUSES: readonly Status[] = ["paid", "pending", "paid", "overdue", "draft", "paid", "pending"];

const SERVER_ORDERS: Order[] = Array.from({ length: 120 }, (_, index) => ({
  id: `ORD-${String(2001 + index)}`,
  customer: CUSTOMERS[(index * 3) % CUSTOMERS.length] ?? "Aurora Bakeri",
  status: STATUSES[index % STATUSES.length] ?? "paid",
  amount: 250 + ((index * 3779) % 24_000),
}));

function cellOf(order: Order, columnId: string): string | number | boolean | undefined {
  switch (columnId) {
    case "customer":
      return order.customer;
    case "status":
      return order.status;
    case "amount":
      return order.amount;
    case "large":
      return order.amount >= 10_000;
    default:
      return undefined;
  }
}

/**
 * Stands in for an API route. It parses the filters as untrusted JSON, filters and pages the rows,
 * and computes each field's facets with every other filter applied.
 */
function fetchOrders(filtersJson: string, { pageIndex, pageSize }: PaginationState): Promise<OrderPage> {
  const filters = parseColumnFilters(JSON.parse(filtersJson), ORDER_FILTERS);
  const passes = (order: Order, skip?: string) =>
    filters.every(({ id, value }) => id === skip || matchesFilter(value, cellOf(order, id)));
  const matching = SERVER_ORDERS.filter((order) => passes(order));
  const counts: Record<string, number> = {};
  for (const order of SERVER_ORDERS.filter((candidate) => passes(candidate, "status"))) {
    counts[order.status] = (counts[order.status] ?? 0) + 1;
  }
  const amounts = SERVER_ORDERS.filter((order) => passes(order, "amount")).map((order) => order.amount);
  // The toggle's count: the large orders among those every other filter keeps.
  const large = {
    counts: {
      true: SERVER_ORDERS.filter((order) => passes(order, "large") && cellOf(order, "large") === true).length,
    },
  };
  // An absent entry means unknown: with no amounts left, the number editor shows no slider.
  const facets: FilterFacets<typeof ORDER_FILTERS> =
    amounts.length === 0
      ? { status: { counts }, large }
      : { status: { counts }, large, amount: { range: [Math.min(...amounts), Math.max(...amounts)] } };
  const page: OrderPage = {
    rows: matching.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    pageCount: Math.max(1, Math.ceil(matching.length / pageSize)),
    facets,
  };
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(page);
    }, 300);
  });
}

const { useAppTable: useOrdersTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({ columnFilteringFeature, rowPaginationFeature }),
  // The server filters and pages, so TanStack does neither and never counts the current page.
  manualFiltering: true,
  manualPagination: true,
  getRowId: (order: Order) => order.id,
});

const columns = createAppColumnHelper<Order>();
const COLUMNS = columns.columns([
  columns.accessor("id", { header: "Order", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("status", { header: "Status", cell: ({ row }) => STATUS_LABELS.get(row.original.status) }),
  columns.accessor("amount", { header: "Amount", cell: ({ cell }) => <cell.CurrencyCell currency="NOK" /> }),
]);

// A stable empty page while loading: TanStack rebuilds the row model whenever `data` changes identity.
const NO_ORDERS: Order[] = [];

/** A fetched page and the request it answers, so a stale page reads as loading. */
type Fetched = { readonly request: string; readonly page: OrderPage };

export function DataTableFilterServer() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 8 });
  const [fetched, setFetched] = useState<Fetched | undefined>(undefined);
  // The request key: the filters as the URL or a request body would carry them, and the page.
  const request = JSON.stringify([columnFilters, pagination]);

  useEffect(() => {
    let current = true;
    void fetchOrders(JSON.stringify(columnFilters), pagination).then((page) => {
      if (current) {
        setFetched({ request, page });
      }
    });
    return () => {
      current = false;
    };
  }, [columnFilters, pagination, request]);

  const result = fetched?.request === request ? fetched.page : undefined;

  const table = useOrdersTable({
    columns: COLUMNS,
    data: result?.rows ?? fetched?.page.rows ?? NO_ORDERS,
    pageCount: result?.pageCount ?? fetched?.page.pageCount ?? -1,
    state: { columnFilters, pagination },
    // The state owner resets to the first page when the filters change.
    onColumnFiltersChange: (updater) => {
      setColumnFilters(updater);
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
  });

  return (
    <table.AppTable>
      <DataTableFilter.Root table={table} fields={ORDER_FILTERS} facets={fetched?.page.facets}>
        <div className="flex w-full min-w-0 flex-col gap-4">
          <DataTableFilter.Bar aria-label="Order filters" />
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <table.Content aria-label="Orders" loading={fetched === undefined} />
          <table.Pagination
            total={{ kind: "known", pageCount: result?.pageCount ?? fetched?.page.pageCount ?? 1 }}
          />
        </div>
      </DataTableFilter.Root>
    </table.AppTable>
  );
}
