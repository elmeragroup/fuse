"use client";

import type { ComponentProps, ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { CaretDoubleLeft } from "../../icons/generated/caret-double-left";
import { CaretDoubleRight } from "../../icons/generated/caret-double-right";
import { CaretLeft } from "../../icons/generated/caret-left";
import { CaretRight } from "../../icons/generated/caret-right";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import { FieldLabel, FieldRoot } from "../field/field";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "../select/select";
import { pageStatus } from "./data-table-pagination-status";
import type { PageStatus, PaginationTotal } from "./data-table-pagination-status";
import type { PaginationSource } from "./data-table-source";
import { dataTableVariants } from "./data-table-variants";
import { dataTableStrings } from "./intl";

const { pagination, pageSize, pageStatus: pageStatusClass, pageControls } = dataTableVariants();

const DEFAULT_PAGE_SIZES: readonly number[] = [10, 25, 50, 100];

/** Props for `DataTable.Pagination`. */
export type DataTablePaginationProps = Omit<ComponentProps<"div">, "children"> & {
  /** The paginated table, from `useTable` with `rowPaginationFeature`. */
  table: PaginationSource;
  /**
   * The page total. It is the only source of Next and Last. Without it the table's own page count
   * is the known total. Pass `{ kind: "unknown", hasMore }` for a cursor API: the status then reads
   * "Page N" and Last stays disabled.
   */
  total?: PaginationTotal;
  /** The rows-per-page choices. The current page size is always offered. Defaults to 10, 25, 50, 100. */
  pageSizes?: readonly number[];
  /** Label of the rows-per-page select. Defaults to the locale dictionary. */
  rowsPerPageLabel?: string;
  /** Formats the page status. Defaults to the locale dictionary's "Page N of M" and "Page N". */
  formatStatus?: (status: PageStatus) => string;
  /** Accessible name of the first-page button. Defaults to the locale dictionary. */
  firstPageLabel?: string;
  /** Accessible name of the previous-page button. Defaults to the locale dictionary. */
  previousPageLabel?: string;
  /** Accessible name of the next-page button. Defaults to the locale dictionary. */
  nextPageLabel?: string;
  /** Accessible name of the last-page button. Defaults to the locale dictionary. */
  lastPageLabel?: string;
};

function pageSizeChoices(pageSizes: readonly number[], current: number): number[] {
  return [...new Set([...pageSizes, current])].toSorted((left, right) => left - right);
}

/**
 * Rows-per-page select, page status, and first, previous, next and last buttons for a paginated
 * table. Changing the page size calls `table.setPageSize` and keeps the page index; resetting to
 * the first page on a size change is the state owner's job, for example in `onPaginationChange`.
 */
export function DataTablePagination({
  table,
  total,
  pageSizes = DEFAULT_PAGE_SIZES,
  rowsPerPageLabel,
  formatStatus,
  firstPageLabel,
  previousPageLabel,
  nextPageLabel,
  lastPageLabel,
  className,
  ...props
}: DataTablePaginationProps): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  const state = table.atoms.pagination.get();
  const status = pageStatus(state.pageIndex, total ?? { kind: "known", pageCount: table.getPageCount() });
  const statusText =
    formatStatus?.(status) ??
    (status.kind === "known"
      ? strings.format("pageOf", { page: status.page, pageCount: status.pageCount })
      : strings.format("page", { page: status.page }));
  const sizes = pageSizeChoices(pageSizes, state.pageSize);
  // Each move's target page index, or `undefined` when the move is unavailable.
  const moves = [
    {
      key: "first",
      label: firstPageLabel ?? strings.format("goToFirstPage"),
      Icon: CaretDoubleLeft,
      target: status.canPrevious ? 0 : undefined,
    },
    {
      key: "previous",
      label: previousPageLabel ?? strings.format("goToPreviousPage"),
      Icon: CaretLeft,
      target: status.canPrevious ? status.page - 2 : undefined,
    },
    {
      key: "next",
      label: nextPageLabel ?? strings.format("goToNextPage"),
      Icon: CaretRight,
      target: status.canNext ? status.page : undefined,
    },
    {
      key: "last",
      label: lastPageLabel ?? strings.format("goToLastPage"),
      Icon: CaretDoubleRight,
      target: status.kind === "known" && status.canNext ? status.pageCount - 1 : undefined,
    },
  ];

  return (
    <div data-slot="data-table-pagination" className={cn(pagination(), className)} {...props}>
      <FieldRoot orientation="horizontal" className={pageSize()}>
        <FieldLabel>{rowsPerPageLabel ?? strings.format("rowsPerPage")}</FieldLabel>
        <SelectRoot<number>
          items={sizes.map((size) => ({
            value: size,
            label: String(size),
          }))}
          value={state.pageSize}
          onValueChange={(size) => {
            if (size !== null) {
              table.setPageSize(size);
            }
          }}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sizes.map((size) => (
              <SelectItem key={size} value={size}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </SelectRoot>
      </FieldRoot>
      <span data-slot="data-table-page-status" className={pageStatusClass()}>
        {statusText}
      </span>
      <div data-slot="data-table-page-controls" className={pageControls()}>
        {moves.map(({ key, label, Icon, target }) => (
          <Button
            key={key}
            variant="outline"
            size="icon-sm"
            aria-label={label}
            disabled={target === undefined}
            onClick={
              target === undefined
                ? undefined
                : () => {
                    table.setPageIndex(target);
                  }
            }>
            <Icon />
          </Button>
        ))}
      </div>
    </div>
  );
}

DataTablePagination.displayName = "DataTable.Pagination";
