"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";

import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";
import type { PaginationState, RowSelectionState, SortingState, Updater } from "@tanstack/react-table";
import { tv } from "tailwind-variants";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { createFuseTableHook, selectColumn } from "@elmeragroup/fuse/data-table";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Empty } from "@elmeragroup/fuse/empty";
import { CaretDown, MagnifyingGlass } from "@elmeragroup/fuse/icons";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";

import { useSideOverlay, useSideRemountKey } from "../window-side";
import { useDashboard } from "./dashboard-context";
import { ORDER_STATUSES, relativeDate, SELLERS, STATUS_ORDER } from "./dashboard-orders";
import type { Order, OrderId } from "./dashboard-orders";
import { searchOrders } from "./dashboard-state";
import { EMPTY_QUERY, FACET_KEYS, FACETS, isNarrowed, optionCount, togglePick } from "./order-query";
import type { FacetKey, OrderQuery } from "./order-query";
import { OrderStatusIcon } from "./order-status-icon";

const orderSearch = tv({
  slots: {
    root: "relative flex min-h-0 flex-1 flex-col",
    toolbar: "flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2",
    // Below the pane's @md width the field takes a row of its own, so its placeholder and query
    // stay readable; Reset, the count and the column menu wrap below it.
    searchRow: "flex flex-wrap items-center gap-2",
    search: "@md:basis-0 min-w-0 grow basis-full",
    columns: "ml-auto",
    // One row of facets at every width; a narrow pane scrolls it sideways instead of stacking.
    // The scroller clips on both axes, so its block padding keeps a trigger's focus ring whole.
    facets: "-mx-3 -my-1 flex items-center gap-2 overflow-x-auto px-3 py-1",
    facetCount: "tabular-nums",
    optionLabel: "min-w-0 flex-1 truncate",
    optionCount: "text-xs ml-auto pl-3 text-muted-foreground tabular-nums",
    total: "text-xs @md:block m-0 hidden shrink-0 whitespace-nowrap text-muted-foreground tabular-nums",
    // ScrollArea's content is as wide as its widest child; containing the inline size keeps the
    // table's own container as the one that scrolls sideways.
    scroll: "min-h-0 flex-1",
    body: "px-3 pb-24 contain-inline-size",
    // The current order's opener carries `aria-current`; its row takes the highlight.
    row: "has-[[aria-current=true]]:bg-accent has-[[aria-current=true]]:text-accent-foreground",
    // The keyboard path to what a row press does: Fuse's row press ignores presses on controls.
    open: "text-xs min-h-6 cursor-pointer rounded-sm font-mono text-muted-foreground tabular-nums outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/60",
    status: "flex items-center gap-2",
    // `outline` draws in the text colour; the border token keeps the badge quieter than the name.
    channel: "border-border text-muted-foreground",
    mono: "text-xs font-mono text-muted-foreground tabular-nums",
    seller: "flex items-center gap-2",
    avatar: "size-5",
    date: "text-muted-foreground tabular-nums",
    pagination: "shrink-0 border-t border-border px-3 py-2",
  },
});

const styles = orderSearch();

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnVisibilityFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    paginatedRowModel: createPaginatedRowModel(),
    sortedRowModel: createSortedRowModel(),
    sortFns,
  }),
  enableSortingRemoval: false,
  getRowId: (order: Order) => String(order.id),
});

const columns = createAppColumnHelper<Order>();

/** The labels the column menu shows for every column a seller can hide. Order stays. */
const COLUMN_LABELS: ReadonlyMap<string, string> = new Map([
  ["customer", "Customer"],
  ["status", "Status"],
  ["product", "Product"],
  ["channel", "Sales channel"],
  ["priceArea", "Price area"],
  ["meterPointId", "Metering point"],
  ["seller", "Seller"],
  ["created", "Created"],
]);

/**
 * The order number as the row's opener, in the one column a seller cannot hide. It carries the
 * queue rows' wiring, so the window's `j`, `k`, `x` and Enter work on the table as on a queue.
 */
function OpenOrder({ order }: { order: Order }): ReactElement {
  const { state, openOrder, revealing, revealed } = useDashboard();
  return (
    <button
      type="button"
      ref={revealing?.id === order.id ? revealed : undefined}
      data-row
      data-order-id={order.id}
      data-customer={order.customer}
      aria-current={state.selected === order.id ? "true" : "false"}
      className={styles.open()}
      onClick={() => {
        openOrder(order.id);
      }}>
      {order.id}
    </button>
  );
}

const COLUMNS = columns.columns([
  selectColumn(columns, { getRowLabel: (order) => `Select ${order.customer}` }),
  columns.accessor("id", {
    header: ({ header }) => <header.SortButton>Order</header.SortButton>,
    enableHiding: false,
    cell: ({ row }) => <OpenOrder order={row.original} />,
  }),
  columns.accessor("customer", {
    header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  // Sorted in the list's group order, failures first, rather than by label.
  columns.accessor((order) => STATUS_ORDER.indexOf(order.status), {
    id: "status",
    header: ({ header }) => <header.SortButton>Status</header.SortButton>,
    cell: ({ row }) => (
      <span className={styles.status()}>
        <OrderStatusIcon status={row.original.status} />
        {ORDER_STATUSES[row.original.status].label}
      </span>
    ),
  }),
  columns.accessor("product", {
    header: ({ header }) => <header.SortButton>Product</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("channel", {
    header: "Sales channel",
    cell: ({ row }) => (
      <Badge variant="outline" size="sm" className={styles.channel()}>
        {row.original.channel}
      </Badge>
    ),
  }),
  columns.accessor((order) => (order.facility._tag === "Known" ? order.facility.priceArea : ""), {
    id: "priceArea",
    header: ({ header }) => <header.SortButton>Price area</header.SortButton>,
    cell: ({ row }) =>
      row.original.facility._tag === "Known" ? row.original.facility.priceArea : "Not looked up",
  }),
  columns.accessor("meterPointId", {
    header: "Metering point",
    cell: ({ row }) => <span className={styles.mono()}>{row.original.meterPointId}</span>,
  }),
  columns.accessor((order) => SELLERS[order.seller].name, {
    id: "seller",
    header: "Seller",
    cell: ({ row }) => {
      const seller = SELLERS[row.original.seller];
      return (
        <span className={styles.seller()}>
          <Avatar.Root className={styles.avatar()}>
            <Avatar.Fallback>{seller.initials}</Avatar.Fallback>
          </Avatar.Root>
          {seller.name}
        </span>
      );
    },
  }),
  // Timestamps from the fixture and from new drafts carry different offsets, so the column sorts
  // by the instant, not the string.
  columns.accessor((order) => Date.parse(order.created), {
    id: "created",
    header: ({ header }) => <header.SortButton>Created</header.SortButton>,
    cell: ({ row }) => (
      <time dateTime={row.original.created} className={styles.date()}>
        {relativeDate(row.original.created)}
      </time>
    ),
  }),
]);

/** One facet's menu: a checkbox per option with the orders it would show, and the pick count. */
function FacetMenu<K extends FacetKey>({ facetKey }: { facetKey: K }): ReactElement {
  const { state, dispatch } = useDashboard();
  const facet = FACETS[facetKey];
  const picked = state.query.picks[facetKey];
  const [open, setOpen] = useSideOverlay(false);
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        render={
          <Button
            variant={picked.length === 0 ? "outline" : "secondary"}
            size="sm"
            aria-label={
              picked.length === 0 ? facet.label : `${facet.label}, ${String(picked.length)} selected`
            }
          />
        }>
        {facet.label}
        {picked.length === 0 ? null : (
          <Badge size="sm" className={styles.facetCount()}>
            {picked.length}
          </Badge>
        )}
        <CaretDown data-icon="inline-end" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Group>
          <DropdownMenu.Label>{facet.label}</DropdownMenu.Label>
          {facet.options.map((option) => (
            <DropdownMenu.CheckboxItem
              key={option}
              checked={picked.includes(option)}
              onCheckedChange={() => {
                dispatch({ _tag: "Query", query: togglePick(state.query, facetKey, option) });
              }}>
              <span className={styles.optionLabel()}>{facet.name(option)}</span>
              <span className={styles.optionCount()}>
                {optionCount(state.orders, state.query, facetKey, option)}
              </span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

function ResetButton(): ReactElement {
  const { dispatch } = useDashboard();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        dispatch({ _tag: "Query", query: EMPTY_QUERY });
      }}>
      Reset
    </Button>
  );
}

function NoMatches(): ReactElement {
  return (
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon">
          <MagnifyingGlass />
        </Empty.Media>
        <Empty.Title>No orders match</Empty.Title>
        <Empty.Description>
          Try another name, order number or metering point, or reset the filters.
        </Empty.Description>
      </Empty.Header>
      <Empty.Content>
        <ResetButton />
      </Empty.Content>
    </Empty.Root>
  );
}

function selectionOf(ids: readonly OrderId[]): RowSelectionState {
  return Object.fromEntries(ids.map((id) => [String(id), true]));
}

const NEWEST_FIRST: SortingState = [{ id: "created", desc: true }];

const FIRST_PAGE: PaginationState = { pageIndex: 0, pageSize: 10 };

/** The table's page, and the query it was turned for. */
type Paging = { readonly query: OrderQuery; readonly pagination: PaginationState };

/**
 * Order search as the sales tool has it: a table of every order with search over the order
 * number, customer, metering point and address, facet filters with a reset, sortable columns,
 * row selection that drives the bulk toolbar, pagination and a column menu. A row press opens the
 * order's detail, as a row in the queues does.
 */
export function OrderSearch(): ReactElement {
  const { state, dispatch, loading, openOrder, revealing } = useDashboard();
  const { orders, query, checked } = state;
  // The Columns menu and the Rows per page Select keep their open state inside Fuse's DataTable,
  // out of `useSideOverlay`'s reach, so a hidden side remounts them, which closes them and drops
  // any scroll lock they hold. They stay in the layout through the flip. The table, owned here,
  // keeps the visible columns, the page size and the page.
  const controlsKey = useSideRemountKey();
  const rows = useMemo(() => searchOrders(orders, query), [orders, query]);
  const data = useMemo(() => (loading ? [] : [...rows]), [loading, rows]);
  const rowSelection = useMemo(() => selectionOf(checked), [checked]);
  const [sorting, setSorting] = useState(NEWEST_FIRST);
  const [paging, setPaging] = useState<Paging>({ query, pagination: FIRST_PAGE });
  // The page is owned here rather than reset by TanStack, which turns back to page one whenever
  // `data` changes, and every order action changes it. A new query or sort starts on page one;
  // an order action keeps the page, or the last page when the rows it held are gone. A new query
  // is stored with page one during render, so a later return to an earlier query, as Reset's
  // `EMPTY_QUERY` is, cannot bring back the page that query was left on.
  if (paging.query !== query) {
    setPaging({ query, pagination: { ...paging.pagination, pageIndex: 0 } });
  }
  const lastPage = Math.max(Math.ceil(rows.length / paging.pagination.pageSize) - 1, 0);
  const pagination: PaginationState = {
    pageSize: paging.pagination.pageSize,
    pageIndex: paging.query === query ? Math.min(paging.pagination.pageIndex, lastPage) : 0,
  };

  const table = useFuseTable({
    columns: COLUMNS,
    data,
    state: { rowSelection, sorting, pagination },
    autoResetPageIndex: false,
    onSortingChange: (updater: Updater<SortingState>) => {
      setSorting(functionalUpdate(updater, sorting));
      setPaging({ query, pagination: { ...pagination, pageIndex: 0 } });
    },
    onPaginationChange: (updater: Updater<PaginationState>) => {
      setPaging({ query, pagination: functionalUpdate(updater, pagination) });
    },
    onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
      const next = functionalUpdate(updater, rowSelection);
      dispatch({
        _tag: "Check",
        ids: rows.filter((order) => next[String(order.id)] === true).map((order) => order.id),
      });
    },
    initialState: {
      // Five columns fit the pane uncut at 1440px; the rest wait in the column menu.
      columnVisibility: { channel: false, priceArea: false, meterPointId: false, seller: false },
    },
  });
  // A pending reveal turns the table to the page that holds its order in the current sort. The
  // shell retires the request once the row has rendered and scrolled into view.
  if (revealing !== undefined && !loading) {
    const index = table.getPrePaginatedRowModel().rows.findIndex((row) => row.original.id === revealing.id);
    const pageIndex = Math.floor(index / pagination.pageSize);
    if (index !== -1 && pageIndex !== pagination.pageIndex) {
      setPaging({ query, pagination: { ...pagination, pageIndex } });
    }
  }

  return (
    <div className={styles.root()}>
      <div role="search" aria-label="Order search" className={styles.toolbar()}>
        <div className={styles.searchRow()}>
          <InputGroup.Root className={styles.search()}>
            <InputGroup.Addon>
              <MagnifyingGlass aria-hidden />
            </InputGroup.Addon>
            <InputGroup.Input
              aria-label="Search orders"
              placeholder="Search orders"
              value={state.query.text}
              onChange={(event) => {
                dispatch({ _tag: "Query", query: { ...state.query, text: event.target.value } });
              }}
            />
          </InputGroup.Root>
          {isNarrowed(state.query) ? <ResetButton /> : null}
          <p role="status" className={styles.total()}>
            {rows.length === orders.length
              ? `${String(orders.length)} orders`
              : `${String(rows.length)} of ${String(orders.length)} orders`}
          </p>
          <table.AppTable>
            <table.ColumnToggle
              key={controlsKey}
              className={styles.columns()}
              getLabel={(column) => COLUMN_LABELS.get(column.id) ?? column.id}
            />
          </table.AppTable>
        </div>
        <div className={styles.facets()}>
          {FACET_KEYS.map((key) => (
            <FacetMenu key={key} facetKey={key} />
          ))}
        </div>
      </div>
      <table.AppTable>
        <ScrollArea.Root className={styles.scroll()}>
          <div className={styles.body()}>
            <table.Content aria-label="Orders" loading={loading} empty={<NoMatches />}>
              {(row) => (
                <table.Row
                  row={row}
                  data-order-id={row.original.id}
                  className={styles.row()}
                  onPress={() => {
                    openOrder(row.original.id);
                  }}
                />
              )}
            </table.Content>
          </div>
        </ScrollArea.Root>
        <table.Pagination key={controlsKey} className={styles.pagination()} pageSizes={[10, 25, 50]} />
      </table.AppTable>
    </div>
  );
}
