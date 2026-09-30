import type { ReactNode } from "react";

/**
 * Structural slices of TanStack Table v9 objects. Each plain part types its `table`, `column`,
 * `header` or `row` prop as only the members it reads, picked from TanStack's exported feature
 * interfaces. A slice accepts the app's table whatever extra features it registered, and rejects
 * a table built without the feature. A part typed as `Table<TFeatures, TData>` with a constrained
 * generic does not work: inside the generic body the feature map stays an unresolved conditional
 * type, and `TFeatures` is invariant.
 *
 * The feature interfaces are generic over `<TFeatures, TData>` only for members this module does
 * not pick, so the picks are instantiated with the unconstrained bases.
 */
import type {
  Column_ColumnVisibility,
  Column_RowSorting,
  PaginationState,
  Row_RowSelection,
  RowData,
  Table_RowPagination,
  Table_RowSelection,
  TableFeatures,
} from "@tanstack/react-table";

/** A column's sorting members, present when `rowSortingFeature` is registered. */
export type SortColumnSource = Pick<
  Column_RowSorting<TableFeatures, RowData>,
  "getCanSort" | "getIsSorted" | "getToggleSortingHandler"
>;

/** The header members `DataTable.Header` reads. Sorting is optional: it drives `aria-sort`. */
export type HeaderSource = {
  readonly id: string;
  readonly colSpan: number;
  readonly isPlaceholder: boolean;
  readonly column: { readonly id: string } & Partial<Pick<SortColumnSource, "getCanSort" | "getIsSorted">>;
};

/** The cell members `DataTable.Row` reads. */
export type CellSource = {
  readonly id: string;
};

/**
 * The row members `DataTable.Row` reads. Visibility and selection are optional: without
 * `columnVisibilityFeature` every cell renders, and without `rowSelectionFeature` no row is
 * selected.
 */
export type RowSource<TCell extends CellSource> = {
  readonly id: string;
  readonly getAllCells: () => ReadonlyArray<TCell>;
  readonly getVisibleCells?: () => ReadonlyArray<TCell>;
  readonly getIsSelected?: () => boolean;
};

/**
 * `table.FlexRender`, which renders a header's or a cell's column-definition template. The plain
 * parts render through the table instance so they import no runtime value from TanStack.
 */
export type HeaderRenderSource<THeader> = {
  readonly FlexRender: (props: { readonly header: NoInfer<THeader> }) => ReactNode;
};

/** `table.FlexRender` for cells. See {@link HeaderRenderSource}. */
export type CellRenderSource<TCell> = {
  readonly FlexRender: (props: { readonly cell: NoInfer<TCell> }) => ReactNode;
};

/** The table members `DataTable.Header` reads. */
export type HeaderGroupsSource<THeader extends HeaderSource> = {
  readonly getHeaderGroups: () => ReadonlyArray<{
    readonly id: string;
    readonly headers: ReadonlyArray<THeader>;
  }>;
};

/**
 * The table members `DataTable.Body` reads. The visible leaf columns size the empty row; without
 * `columnVisibilityFeature` every leaf column is visible. The page size sizes the loading state;
 * without `rowPaginationFeature` it shows a fixed number of skeleton rows.
 */
export type RowsSource<TRow> = {
  readonly getRowModel: () => { readonly rows: ReadonlyArray<TRow> };
  readonly getAllLeafColumns: () => ReadonlyArray<unknown>;
  readonly getVisibleLeafColumns?: () => ReadonlyArray<unknown>;
  readonly atoms: { readonly pagination?: { readonly get: () => Pick<PaginationState, "pageSize"> } };
};

/** The table members `DataTable.Pagination` reads. */
export type PaginationSource = Pick<
  Table_RowPagination<TableFeatures, RowData>,
  "getPageCount" | "setPageIndex" | "setPageSize"
> & {
  readonly atoms: { readonly pagination: { readonly get: () => PaginationState } };
};

/** A column's visibility members, present when `columnVisibilityFeature` is registered. */
export type VisibilityColumnSource = { readonly id: string } & Pick<
  Column_ColumnVisibility,
  "getCanHide" | "getIsVisible" | "toggleVisibility"
>;

/** The table members `DataTable.ColumnToggle` reads. */
export type ColumnToggleSource<TColumn extends VisibilityColumnSource> = {
  readonly getAllLeafColumns: () => ReadonlyArray<TColumn>;
};

/** The table members `DataTable.SelectAll` reads: the current page, never unloaded rows. */
export type SelectAllSource = Pick<
  Table_RowSelection<TableFeatures, RowData>,
  "getIsAllPageRowsSelected" | "getIsSomePageRowsSelected" | "toggleAllPageRowsSelected"
>;

/** The row members `DataTable.SelectRow` reads. */
export type SelectRowSource = Pick<Row_RowSelection, "getCanSelect" | "getIsSelected" | "toggleSelected">;
