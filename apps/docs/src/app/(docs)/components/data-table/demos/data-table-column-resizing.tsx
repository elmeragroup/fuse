"use client";

import { useEffect, useState } from "react";

import {
  columnResizingFeature,
  columnSizingFeature,
  createSortedRowModel,
  functionalUpdate,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";
import type { ColumnSizingState } from "@tanstack/react-table";

import { createFuseTableHook, selectColumn } from "@elmeragroup/fuse/data-table";

type Ticket = {
  readonly id: string;
  readonly subject: string;
  readonly channel: string;
  readonly status: string;
  readonly queue: string;
};

const TICKETS: Ticket[] = [
  {
    id: "T-2041",
    subject: "Invoice sent to the wrong address",
    channel: "Email",
    status: "Open",
    queue: "Billing",
  },
  {
    id: "T-2042",
    subject: "Cannot log in after password reset",
    channel: "Chat",
    status: "Waiting",
    queue: "Accounts",
  },
  {
    id: "T-2043",
    subject: "Request to move the contract start date",
    channel: "Phone",
    status: "Solved",
    queue: "Contracts",
  },
];

/** Where the demo keeps the column widths between visits. */
const WIDTHS_KEY = "fuse-demo:ticket-table-widths";

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnSizingFeature,
    columnResizingFeature,
    rowSelectionFeature,
    rowSortingFeature,
    sortedRowModel: createSortedRowModel(),
    sortFns,
  }),
  enableSortingRemoval: false,
  getRowId: (ticket: Ticket) => ticket.id,
});

const columns = createAppColumnHelper<Ticket>();

const COLUMNS = columns.columns([
  selectColumn(columns, { getRowLabel: (ticket) => `Select ticket ${ticket.id}` }),
  columns.accessor("id", {
    header: "Ticket",
    size: 96,
    enableResizing: false,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("subject", {
    header: ({ header }) => (
      <>
        <header.SortButton>Subject</header.SortButton>
        <header.ResizeHandle columnName="Subject" />
      </>
    ),
    size: 280,
    minSize: 160,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("channel", {
    header: ({ header }) => (
      <>
        Channel
        <header.ResizeHandle columnName="Channel" />
      </>
    ),
    size: 120,
    minSize: 80,
    maxSize: 200,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("status", {
    header: ({ header }) => (
      <>
        <header.SortButton>Status</header.SortButton>
        <header.ResizeHandle columnName="Status" />
      </>
    ),
    size: 120,
    minSize: 96,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("queue", {
    header: ({ header }) => (
      <>
        Queue
        <header.ResizeHandle columnName="Queue" />
      </>
    ),
    size: 140,
    minSize: 96,
    cell: ({ cell }) => <cell.TextCell />,
  }),
]);

/** The stored widths, keeping only entries that hold a finite number. */
function parseWidths(stored: string | null): ColumnSizingState {
  if (stored === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!(parsed instanceof Object)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => Number.isFinite(entry[1]))
    );
  } catch {
    return {};
  }
}

export function DataTableColumnResizing() {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  useEffect(() => {
    try {
      // oxlint-disable-next-line react/set-state-in-effect -- storage exists only in the browser, so the widths load after hydration and the server and first client render agree
      setColumnSizing(parseWidths(window.localStorage.getItem(WIDTHS_KEY)));
    } catch {
      // Storage can be blocked. The table keeps its default widths.
    }
  }, []);

  const table = useFuseTable({
    columns: COLUMNS,
    data: TICKETS,
    state: { columnSizing },
    onColumnSizingChange: (updater) => {
      const next = functionalUpdate(updater, columnSizing);
      setColumnSizing(next);
      try {
        window.localStorage.setItem(WIDTHS_KEY, JSON.stringify(next));
      } catch {
        // Storage can be blocked or full. The widths last until the page reloads.
      }
    },
  });

  return (
    <table.AppTable>
      <table.Content aria-label="Support tickets" />
    </table.AppTable>
  );
}
