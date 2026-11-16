"use client";

import { useEffect, useState } from "react";

import { columnFilteringFeature, createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import type { ColumnFiltersState } from "@tanstack/react-table";

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

type OrderResult = {
  readonly total: number;
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
 * Stands in for an API route. It parses the filters as untrusted JSON, counts the matching rows,
 * and computes each field's facets with every other filter applied.
 */
function fetchOrders(filtersJson: string): Promise<OrderResult> {
  const filters = parseColumnFilters(JSON.parse(filtersJson), ORDER_FILTERS);
  const passes = (order: Order, skip?: string) =>
    filters.every(({ id, value }) => id === skip || matchesFilter(value, cellOf(order, id)));
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
  const result: OrderResult = { total: SERVER_ORDERS.filter((order) => passes(order)).length, facets };
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(result);
    }, 300);
  });
}

const features = tableFeatures({ columnFilteringFeature });

const columns = createColumnHelper<typeof features, Order>();
const COLUMNS = columns.columns([
  columns.accessor("customer", {}),
  columns.accessor("status", {}),
  columns.accessor("amount", {}),
]);

// The server filters, so the table holds no rows. A stable array keeps TanStack from rebuilding
// its row model on every render.
const NO_ORDERS: Order[] = [];

/** A fetched result and the filters it answers, so a stale result reads as loading. */
type Fetched = { readonly request: string; readonly result: OrderResult };

export function DataTableFilterServer() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [fetched, setFetched] = useState<Fetched | undefined>(undefined);
  // The filters as the URL or a request body would carry them.
  const request = JSON.stringify(columnFilters);

  useEffect(() => {
    let current = true;
    void fetchOrders(request).then((result) => {
      if (current) {
        setFetched({ request, result });
      }
    });
    return () => {
      current = false;
    };
  }, [request]);

  const table = useTable({
    features,
    columns: COLUMNS,
    data: NO_ORDERS,
    // The server filters, so TanStack does not.
    manualFiltering: true,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
  });

  return (
    <DataTableFilter.Root table={table} fields={ORDER_FILTERS} facets={fetched?.result.facets}>
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DataTableFilter.Bar aria-label="Order filters" />
        <DataTableFilter.Content />
        <DataTableFilter.ValueContent />
        <output className="text-sm text-muted-foreground tabular-nums">
          {fetched?.request === request
            ? `${String(fetched.result.total)} of ${String(SERVER_ORDERS.length)} orders`
            : "Loading orders"}
        </output>
      </div>
    </DataTableFilter.Root>
  );
}
