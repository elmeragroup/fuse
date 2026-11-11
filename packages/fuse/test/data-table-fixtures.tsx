import type { ReactElement } from "react";

/**
 * The orders tables the data table's browser suites drive: generated and handwritten rows, the
 * sorting, visibility, selection and pagination feature set, and a plain and a registered column
 * set. Suites write their expected rows and labels out by hand from these rows.
 */
import {
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

import { createFuseTableHook } from "../src/components/data-table/create-fuse-table-hook";
import { withLocale } from "./locale-matrix";
import { renderThemed } from "./themed-browser-render";

/** One order row. */
export type Order = { readonly id: number; readonly customer: string; readonly amount: number };

/** Orders numbered from 1: `Customer <n>` with an amount of `n × 1000.5`. */
function ordersOf(count: number): Order[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    customer: `Customer ${String(index + 1)}`,
    amount: (index + 1) * 1000.5,
  }));
}

// Module-level rows: TanStack resets the page index whenever `data` changes identity, so a fixture
// must not build its rows during render.
/** Three generated orders. */
export const ORDERS_3 = ordersOf(3);
/** Twenty-five generated orders, three pages of ten. */
export const ORDERS_25 = ordersOf(25);
/** No orders, for the empty state. */
export const NO_ORDERS: Order[] = [];

/** Three handwritten orders whose customers and amounts sort differently. */
export const ORDERS: Order[] = [
  { id: 1, customer: "Bergen", amount: 1234.5 },
  { id: 2, customer: "Alta", amount: 20 },
  { id: 3, customer: "Oslo", amount: 300 },
];

/**
 * Renders a node themed, under the `en-US` locale.
 *
 * @param node - The element to render.
 * @returns The render result, whose `rerender` renders its node under the same theme and locale.
 */
export function renderInEnglish(node: ReactElement) {
  const result = renderThemed(withLocale("en-US", node));
  return {
    ...result,
    rerender: (next: ReactElement): void => {
      result.rerender(withLocale("en-US", next));
    },
  };
}

/** Sorting, visibility, selection and client pagination. */
export const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

const fuseTable = createFuseTableHook({
  features,
  getRowId: (order: Order) => String(order.id),
});

// Annotated through `typeof`: the inferred hook type names TanStack's store, which the
// declaration emit cannot reference.
/** The registered-parts table hook over {@link features}, keyed by order id. */
export const useFuseTable: typeof fuseTable.useAppTable = fuseTable.useAppTable;

/** The registered column helper for orders. */
export const appColumns = fuseTable.createAppColumnHelper<Order>();

/** A sortable Customer column and an unsortable Amount column, through the registered cells. */
export const registeredColumns = appColumns.columns([
  appColumns.accessor("customer", {
    header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  appColumns.accessor("amount", {
    header: "Amount",
    enableSorting: false,
    cell: ({ cell }) => <cell.NumberCell maximumFractionDigits={1} />,
  }),
]);

/** A plain Customer column for tables that do not use the registered parts. */
export const plainColumns = createColumnHelper<typeof features, Order>().columns([
  createColumnHelper<typeof features, Order>().accessor("customer", { header: "Customer" }),
]);
