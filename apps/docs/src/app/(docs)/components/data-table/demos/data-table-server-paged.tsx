"use client";

import { useEffect, useState } from "react";

import { functionalUpdate, rowPaginationFeature, tableFeatures } from "@tanstack/react-table";
import type { PaginationState } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Reading = { readonly meter: string; readonly kwh: number; readonly readAt: Date };

type ReadingPage = { readonly rows: Reading[]; readonly hasMore: boolean };

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({ rowPaginationFeature }),
  // The server pages the rows, and it cannot count them.
  manualPagination: true,
  pageCount: -1,
});

const columns = createAppColumnHelper<Reading>();

const COLUMNS = columns.columns([
  columns.accessor("meter", { header: "Meter", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("kwh", {
    header: "kWh",
    cell: ({ cell }) => <cell.NumberCell maximumFractionDigits={1} />,
  }),
  columns.accessor("readAt", { header: "Read at", cell: ({ cell }) => <cell.DateTimeCell /> }),
]);

const TOTAL_READINGS = 32;

/** Stands in for a cursor API: it returns one page and whether another follows, never a count. */
function fetchReadings({ pageIndex, pageSize }: PaginationState): Promise<ReadingPage> {
  const start = pageIndex * pageSize;
  const rows = Array.from(
    { length: Math.max(0, Math.min(pageSize, TOTAL_READINGS - start)) },
    (_, offset) => {
      const index = start + offset;
      return {
        meter: `707057500${String(100 + index)}`,
        kwh: 12 + ((index * 7.3) % 40),
        readAt: new Date(Date.UTC(2026, 8, 1, index % 24, (index * 13) % 60)),
      };
    }
  );
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ rows, hasMore: start + pageSize < TOTAL_READINGS });
    }, 400);
  });
}

/** A fetched page and the request it answers, so a stale page reads as loading. */
type Fetched = { readonly request: PaginationState; readonly page: ReadingPage };

export function DataTableServerPaged() {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [fetched, setFetched] = useState<Fetched | undefined>(undefined);

  useEffect(() => {
    let current = true;
    void fetchReadings(pagination).then((page) => {
      if (current) {
        setFetched({ request: pagination, page });
      }
    });
    return () => {
      current = false;
    };
  }, [pagination]);

  const result = fetched?.request === pagination ? fetched.page : undefined;

  const table = useFuseTable({
    columns: COLUMNS,
    data: result?.rows ?? [],
    state: { pagination },
    // The state owner resets to the first page when the page size changes.
    onPaginationChange: (updater) => {
      setPagination((previous) => {
        const next = functionalUpdate(updater, previous);
        return next.pageSize === previous.pageSize ? next : { ...next, pageIndex: 0 };
      });
    },
  });

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <table.Content aria-label="Meter readings" loading={result === undefined} />
        <table.Pagination total={{ kind: "unknown", hasMore: result?.hasMore ?? false }} />
      </div>
    </table.AppTable>
  );
}
