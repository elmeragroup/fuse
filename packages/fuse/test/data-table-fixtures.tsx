import { useState } from "react";
import type { ReactElement } from "react";

/**
 * The orders tables the data table's browser suites drive: generated and handwritten rows, the
 * sorting, visibility, selection and pagination feature set, and a plain and a registered column
 * set. Suites write their expected rows and labels out by hand from these rows.
 */
import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  functionalUpdate,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnSizingState, SortingState } from "@tanstack/react-table";

import { actionsColumn } from "../src/components/data-table/actions-column";
import { createFuseTableHook } from "../src/components/data-table/create-fuse-table-hook";
import { DataTable } from "../src/components/data-table/index";
import { selectColumn } from "../src/components/data-table/select-column";
import { DropdownMenu } from "../src/components/dropdown-menu";
import { Table } from "../src/components/table/table";
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

/** One support ticket row. */
export type Ticket = { readonly id: number; readonly subject: string; readonly status: string };

const TICKETS: Ticket[] = [
  { id: 101, subject: "Invoice copy", status: "Open" },
  { id: 102, subject: "Change of address", status: "Waiting" },
];

/** The width of the ticket table's Ticket column, which cannot be resized. */
export const TICKET_COLUMN_SIZE = 80;

const resizable = createFuseTableHook({
  features: tableFeatures({
    columnSizingFeature,
    columnResizingFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns,
  }),
  getRowId: (ticket: Ticket) => String(ticket.id),
});
const ticketColumns = resizable.createAppColumnHelper<Ticket>();

/** How many times the ticket table's body has rendered a Subject cell. */
export const subjectCellRenders = { count: 0 };

/**
 * The selection column, a Ticket column that cannot be resized, a sortable Subject column of 160px
 * between 120 and 200px, and a Status column of 100px with TanStack's default bounds. Every column
 * but the selection column renders a resize handle.
 */
const resizableTicketColumns = ticketColumns.columns([
  selectColumn(ticketColumns, { getRowLabel: (ticket) => `Select ticket ${String(ticket.id)}` }),
  ticketColumns.accessor("id", {
    header: ({ header }) => (
      <>
        Ticket
        <header.ResizeHandle columnName="Ticket" />
      </>
    ),
    size: TICKET_COLUMN_SIZE,
    enableResizing: false,
    cell: ({ cell }) => <cell.NumberCell useGrouping={false} />,
  }),
  ticketColumns.accessor("subject", {
    header: ({ header }) => (
      <>
        <header.SortButton>Subject</header.SortButton>
        <header.ResizeHandle columnName="Subject" />
      </>
    ),
    size: 160,
    minSize: 120,
    maxSize: 200,
    cell: ({ cell }) => {
      subjectCellRenders.count += 1;
      return <cell.TextCell />;
    },
  }),
  ticketColumns.accessor("status", {
    header: ({ header }) => (
      <>
        Status
        <header.ResizeHandle columnName="Status" />
      </>
    ),
    size: 100,
    enableSorting: false,
    cell: ({ cell }) => <cell.TextCell />,
  }),
]);

/**
 * A resizable ticket table that keeps `columnSizing` itself, as an app does.
 *
 * @param props - `onSizing`, called with every `columnSizing` state the table commits.
 * `canResize` sets `enableColumnResizing`, so `false` removes every handle. `locked` reports each
 * commit through `onSizing` but never stores it, as an app that refuses a resize does.
 * @returns The table.
 */
export function ResizableTicketTable({
  onSizing,
  canResize = true,
  locked = false,
}: {
  readonly onSizing?: (sizing: ColumnSizingState) => void;
  readonly canResize?: boolean;
  readonly locked?: boolean;
}): ReactElement {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const table = resizable.useAppTable({
    columns: resizableTicketColumns,
    data: TICKETS,
    enableColumnResizing: canResize,
    state: { columnSizing },
    onColumnSizingChange: (updater) => {
      const next = functionalUpdate(updater, columnSizing);
      onSizing?.(next);
      if (!locked) {
        setColumnSizing(next);
      }
    },
  });
  return (
    <table.AppTable>
      <table.Content aria-label="Tickets" />
    </table.AppTable>
  );
}

/**
 * A resizable Ticket column of 24px, narrower than the handle's 32px minimum but above TanStack's
 * default `minSize` of 20, and the row-actions column.
 */
const compactTicketColumns = ticketColumns.columns([
  ticketColumns.accessor("id", {
    header: ({ header }) => (
      <>
        Ticket
        <header.ResizeHandle columnName="Ticket" />
      </>
    ),
    size: 24,
    cell: ({ cell }) => <cell.NumberCell useGrouping={false} />,
  }),
  actionsColumn(ticketColumns, {
    getRowName: (ticket) => ticket.subject,
    items: () => <DropdownMenu.Item>Open</DropdownMenu.Item>,
  }),
]);

/**
 * A sized ticket table with a column narrower than the handle's minimum and the row-actions column.
 *
 * @param props - `onSizing`, called with every `columnSizing` state the table commits.
 * @returns The table.
 */
export function CompactTicketTable({
  onSizing,
}: {
  readonly onSizing?: (sizing: ColumnSizingState) => void;
}): ReactElement {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const table = resizable.useAppTable({
    columns: compactTicketColumns,
    data: TICKETS,
    state: { columnSizing },
    onColumnSizingChange: (updater) => {
      const next = functionalUpdate(updater, columnSizing);
      onSizing?.(next);
      setColumnSizing(next);
    },
  });
  return (
    <table.AppTable>
      <table.Content aria-label="Compact tickets" />
    </table.AppTable>
  );
}

// `DataTable.Body` reads the page size, so its table slice needs `rowPaginationFeature`.
const plainResizeFeatures = tableFeatures({
  columnSizingFeature,
  columnResizingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
});
const plainTicketColumns = createColumnHelper<typeof plainResizeFeatures, Ticket>();

/**
 * A plain-parts Subject column of 160px between 120 and 200px, whose header label and resize
 * handle sit inside one element that toggles sorting on click, and a Status column of 100px.
 */
const plainResizableColumns = plainTicketColumns.columns([
  plainTicketColumns.accessor("subject", {
    header: ({ header }) => (
      // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- a click-to-sort header region, the shape a handle's clicks must not reach
      <div onClick={header.column.getToggleSortingHandler()}>
        Subject
        <DataTable.ResizeHandle header={header} columnName="Subject" />
      </div>
    ),
    size: 160,
    minSize: 120,
    maxSize: 200,
  }),
  plainTicketColumns.accessor("status", {
    header: ({ header }) => (
      <>
        Status
        <DataTable.ResizeHandle header={header} columnName="Status" />
      </>
    ),
    size: 100,
  }),
]);

/**
 * The ticket table from the plain parts, `DataTable.Header` and `DataTable.Body` in a
 * `Table.Root` set up as the `DataTable.Header` JSDoc says, with sorting kept by the table.
 *
 * @param props - `onSorting`, called with every sorting state the table commits.
 * @returns The table.
 */
export function PlainResizableTicketTable({
  onSorting,
}: {
  readonly onSorting?: (sorting: SortingState) => void;
}): ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useTable({
    features: plainResizeFeatures,
    columns: plainResizableColumns,
    data: TICKETS,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting);
      onSorting?.(next);
      setSorting(next);
    },
  });
  return (
    <Table.Root aria-label="Plain tickets" className="w-0 table-fixed">
      <DataTable.Header table={table} />
      <DataTable.Body table={table} />
    </Table.Root>
  );
}

/** One queue assignment row. */
type Assignment = { readonly id: number; readonly queue: string; readonly channel: string };

const ASSIGNMENTS: Assignment[] = [
  { id: 1, queue: "Billing", channel: "Email" },
  { id: 2, queue: "Accounts", channel: "Chat" },
];

const assignmentTable = createFuseTableHook({
  features: tableFeatures({
    columnSizingFeature,
    columnResizingFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns,
  }),
  getRowId: (assignment: Assignment) => String(assignment.id),
});
const assignmentColumns = assignmentTable.createAppColumnHelper<Assignment>();

/**
 * Two resizable columns, the first in the table: a sortable Queue column of 100px with TanStack's
 * default bounds, whose label is wider than that, and a Channel column of 150px whose `maxSize` is
 * `Infinity`, which TanStack reads as no maximum.
 */
const resizableAssignmentColumns = assignmentColumns.columns([
  assignmentColumns.accessor("queue", {
    header: ({ header }) => (
      <>
        <header.SortButton>Assigned support queue</header.SortButton>
        <header.ResizeHandle columnName="Queue" />
      </>
    ),
    size: 100,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  assignmentColumns.accessor("channel", {
    header: ({ header }) => (
      <>
        Channel
        <header.ResizeHandle columnName="Channel" />
      </>
    ),
    size: 150,
    maxSize: Number.POSITIVE_INFINITY,
    cell: ({ cell }) => <cell.TextCell />,
  }),
]);

/**
 * A resizable table whose two columns keep TanStack's default minimum, so the handles can take
 * them down to their minimum width.
 *
 * @returns The table.
 */
export function ResizableAssignmentTable(): ReactElement {
  const table = assignmentTable.useAppTable({ columns: resizableAssignmentColumns, data: ASSIGNMENTS });
  return (
    <table.AppTable>
      <table.Content aria-label="Assignments" />
    </table.AppTable>
  );
}
