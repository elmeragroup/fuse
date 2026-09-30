"use client";

import { Fragment } from "react";
import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { definedProps } from "../../internal/defined-props";
import { cn } from "../../styles/cn";
import { Skeleton } from "../skeleton/skeleton";
import { Table } from "../table/table";
import type {
  CellRenderSource,
  CellSource,
  HeaderGroupsSource,
  HeaderRenderSource,
  HeaderSource,
  RowSource,
  RowsSource,
} from "./data-table-source";
import { dataTableVariants } from "./data-table-variants";
import { dataTableStrings } from "./intl";

const { emptyCell, head, skeleton } = dataTableVariants();

/** The cell type a row's `getAllCells()` returns. */
type CellOf<TRow> = TRow extends RowSource<infer TCell> ? TCell : never;

/**
 * Elements a click on a row must not also press the row through: native controls, links, and the
 * ARIA widgets Fuse renders as non-native elements, such as Base UI's checkbox span. `closest()`
 * matches an SVG icon inside one of them, too.
 */
const INTERACTIVE_DESCENDANT = [
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "[role=button]",
  "[role=link]",
  "[role=checkbox]",
  "[role=switch]",
  "[role=combobox]",
  "[role=menuitem]",
].join(",");

/**
 * Whether a click on a row presses it. React bubbles a click from a portal, such as an open menu,
 * to the `<tr>` that owns it in the React tree, though its DOM sits outside the row; such a click
 * never presses the row. Inside the row, an interactive element owns its click.
 *
 * @param target - The click's target.
 * @param row - The `<tr>` that received the click.
 * @returns `true` when the target sits inside the row's DOM and outside every interactive element in it.
 */
function pressesRow(target: EventTarget | null, row: Element): boolean {
  if (!(target instanceof Element) || !row.contains(target)) {
    return false;
  }
  const interactive = target.closest(INTERACTIVE_DESCENDANT);
  return interactive === null || interactive === row || !row.contains(interactive);
}

function ariaSort(column: HeaderSource["column"]): "ascending" | "descending" | "none" | undefined {
  if (column.getCanSort?.() !== true) {
    return undefined;
  }
  const sorted = column.getIsSorted?.();
  return sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
}

/** Header rows over any header renderer. */
function HeaderRows<THeader extends HeaderSource>({
  headerGroups,
  renderHeader,
  ...props
}: ComponentProps<"thead"> & {
  headerGroups: ReturnType<HeaderGroupsSource<THeader>["getHeaderGroups"]>;
  renderHeader: (header: THeader) => ReactNode;
}): ReactElement {
  return (
    <Table.Header data-slot="data-table-header" {...props}>
      {headerGroups.map((group) => (
        <Table.Row key={group.id}>
          {group.headers.map((header) => {
            const sort = ariaSort(header.column);
            return (
              <Table.Head
                key={header.id}
                colSpan={header.colSpan}
                className={head()}
                {...definedProps({ "aria-sort": sort })}>
                {header.isPlaceholder ? null : renderHeader(header)}
              </Table.Head>
            );
          })}
        </Table.Row>
      ))}
    </Table.Header>
  );
}

/** What the body shows when there are no rows. */
type BodyState = {
  /**
   * Renders skeleton rows while there are no rows yet, and marks the table busy through
   * `Content`.
   */
  loading?: boolean;
  /** Replaces the localized "No results." text of the empty row. */
  empty?: ReactNode;
};

/** Skeleton rows never exceed this, whatever the page size. */
const MAX_SKELETON_ROWS = 10;

/** Skeleton rows for a table without pagination. */
const DEFAULT_SKELETON_ROWS = 5;

/**
 * The number of skeleton rows a loading table shows.
 *
 * @param pageSize - The table's page size, or `undefined` without `rowPaginationFeature`.
 * @returns The page size clamped to one through ten, or five without a page size.
 */
export function skeletonRowCount(pageSize: number | undefined): number {
  if (pageSize === undefined || Number.isNaN(pageSize)) {
    return DEFAULT_SKELETON_ROWS;
  }
  return Math.min(MAX_SKELETON_ROWS, Math.max(1, Math.floor(pageSize)));
}

/** The number of columns a full-width row spans: the visible leaf columns. */
function visibleColumnCount(table: RowsSource<unknown>): number {
  return (table.getVisibleLeafColumns?.() ?? table.getAllLeafColumns()).length;
}

/** The page size, or `undefined` for a table without `rowPaginationFeature`. */
function pageSizeOf(table: RowsSource<unknown>): number | undefined {
  return table.atoms.pagination?.get().pageSize;
}

/** The body of a table's current row model over any row renderer. */
function BodyRows<TRow extends { readonly id: string }>({
  table,
  loading,
  empty,
  renderRow,
  ...props
}: ComponentProps<"tbody"> &
  BodyState & {
    table: RowsSource<TRow>;
    renderRow: (row: TRow) => ReactNode;
  }): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  const { rows } = table.getRowModel();
  const columnCount = visibleColumnCount(table);
  let content: ReactNode;
  if (rows.length > 0) {
    content = rows.map((row) => <Fragment key={row.id}>{renderRow(row)}</Fragment>);
  } else if (loading) {
    content = Array.from({ length: skeletonRowCount(pageSizeOf(table)) }, (_, index) => (
      <Table.Row key={index} data-slot="data-table-skeleton-row">
        {Array.from({ length: columnCount }, (_cell, column) => (
          <Table.Cell key={column}>
            <Skeleton className={skeleton()} />
          </Table.Cell>
        ))}
      </Table.Row>
    ));
  } else {
    content = (
      <Table.Row data-slot="data-table-empty-row">
        <Table.Cell colSpan={Math.max(1, columnCount)} className={emptyCell()}>
          {empty ?? strings.format("noResults")}
        </Table.Cell>
      </Table.Row>
    );
  }
  return (
    <Table.Body data-slot="data-table-body" {...props}>
      {content}
    </Table.Body>
  );
}

/** Package-private row over any cell renderer. The registered parts pass `table.AppCell`. */
export function RowCells<TCell extends CellSource>({
  row,
  renderCell,
  onPress,
  onClick,
  className,
  ...props
}: Omit<DataTableRowProps<TCell>, "table"> & { renderCell: (cell: TCell) => ReactNode }): ReactElement {
  const cells = row.getVisibleCells?.() ?? row.getAllCells();
  return (
    <Table.Row
      data-slot="data-table-row"
      {...definedProps({ "data-state": row.getIsSelected?.() === true ? "selected" : undefined })}
      className={cn(dataTableVariants({ pressable: onPress !== undefined }).row(), className)}
      onClick={(event) => {
        onClick?.(event);
        if (
          onPress !== undefined &&
          !event.defaultPrevented &&
          pressesRow(event.target, event.currentTarget)
        ) {
          onPress(event);
        }
      }}
      {...props}>
      {cells.map((cell) => (
        <Table.Cell key={cell.id}>{renderCell(cell)}</Table.Cell>
      ))}
    </Table.Row>
  );
}

/**
 * Package-private whole table over any header and row renderer: `DataTable.Content` passes
 * `table.FlexRender` and `DataTable.Row`, the registered `table.Content` passes `table.AppHeader`
 * and `table.Row`. While `loading` the table carries `aria-busy`.
 */
export function ContentTable<THeader extends HeaderSource, TRow extends { readonly id: string }>({
  table,
  loading,
  empty,
  renderHeader,
  renderRow,
  ...props
}: Omit<ComponentProps<"table">, "children"> &
  BodyState & {
    table: HeaderGroupsSource<THeader> & RowsSource<TRow>;
    renderHeader: (header: THeader) => ReactNode;
    renderRow: (row: TRow) => ReactNode;
  }): ReactElement {
  return (
    <Table.Root {...definedProps({ "aria-busy": loading === true || undefined })} {...props}>
      <HeaderRows headerGroups={table.getHeaderGroups()} renderHeader={renderHeader} />
      <BodyRows table={table} loading={loading} empty={empty} renderRow={renderRow} />
    </Table.Root>
  );
}

/** Props for `DataTable.Header`. */
export type DataTableHeaderProps<THeader extends HeaderSource> = ComponentProps<"thead"> & {
  /** The table whose header groups render, typically from `useTable`. */
  table: HeaderGroupsSource<THeader> & HeaderRenderSource<THeader>;
};

/**
 * Every header group of a table as `<thead>` rows. Each `<th>` takes the header's `colSpan`,
 * renders nothing for a placeholder, and carries `aria-sort` (`ascending`, `descending` or `none`)
 * only when its column can sort.
 */
export function DataTableHeader<THeader extends HeaderSource>({
  table,
  ...props
}: DataTableHeaderProps<THeader>): ReactElement {
  return (
    <HeaderRows
      headerGroups={table.getHeaderGroups()}
      renderHeader={(header) => <table.FlexRender header={header} />}
      {...props}
    />
  );
}

/** Props for `DataTable.Body`. */
export type DataTableBodyProps<TRow extends RowSource<TCell>, TCell extends CellSource = CellOf<TRow>> = Omit<
  ComponentProps<"tbody">,
  "children"
> &
  BodyState & {
    /** The table whose current row model renders, typically from `useTable`. */
    table: RowsSource<TRow> & CellRenderSource<TCell>;
    /** Takes over row rendering, for example to render `DataTable.Row` with `onPress`. */
    children?: (row: TRow) => ReactNode;
  };

/**
 * The rows of a table's current row model. With no rows it renders skeleton rows while `loading`
 * (page-size many, at most ten), or else one row whose cell spans the visible leaf columns and
 * shows `empty`.
 */
export function DataTableBody<TRow extends RowSource<TCell>, TCell extends CellSource = CellOf<TRow>>({
  table,
  children,
  ...props
}: DataTableBodyProps<TRow, TCell>): ReactElement {
  return (
    <BodyRows
      table={table}
      renderRow={children ?? ((row) => <DataTableRow table={table} row={row} />)}
      {...props}
    />
  );
}

/** Props for `DataTable.Content`. */
export type DataTableContentProps<
  THeader extends HeaderSource,
  TRow extends RowSource<TCell>,
  TCell extends CellSource = CellOf<TRow>,
> = Omit<ComponentProps<"table">, "children"> &
  BodyState & {
    /** The table to render, typically from `useTable`. */
    table: HeaderGroupsSource<THeader> &
      HeaderRenderSource<THeader> &
      RowsSource<TRow> &
      CellRenderSource<TCell>;
    /** Takes over row rendering, for example to render `DataTable.Row` with `onPress`. */
    children?: (row: TRow) => ReactNode;
  };

/**
 * A whole table on Fuse `Table`: the shared content table with `table.FlexRender` headers and
 * `DataTable.Row` rows. While `loading` the table carries `aria-busy`. Pass `children` to render
 * each row yourself.
 */
export function DataTableContent<
  THeader extends HeaderSource,
  TRow extends RowSource<TCell>,
  TCell extends CellSource = CellOf<TRow>,
>({ table, loading = false, children, ...props }: DataTableContentProps<THeader, TRow, TCell>): ReactElement {
  return (
    <ContentTable
      table={table}
      loading={loading}
      renderHeader={(header) => <table.FlexRender header={header} />}
      renderRow={children ?? ((row) => <DataTableRow table={table} row={row} />)}
      {...props}
    />
  );
}

/** Props for `DataTable.Row`. */
export type DataTableRowProps<TCell extends CellSource> = ComponentProps<"tr"> & {
  /** The table that renders the cell templates. */
  table: CellRenderSource<TCell>;
  /** The row to render. */
  row: RowSource<TCell>;
  /**
   * Makes the whole row clickable without changing its role: the `<tr>` gets no `role="button"`
   * and no `tabIndex`, so table navigation keeps working. Clicks on a link, button, input or other
   * interactive element in the row do not press it, and neither do clicks inside a portal the row
   * renders, such as an open menu. Keyboard users need the same action through a
   * focusable primary action in the row, such as a link in its first cell.
   */
  onPress?: (event: MouseEvent<HTMLTableRowElement>) => void;
};

/**
 * One table row with its visible cells. A selected row carries `data-state="selected"`.
 */
export function DataTableRow<TCell extends CellSource>({
  table,
  ...props
}: DataTableRowProps<TCell>): ReactElement {
  return <RowCells renderCell={(cell) => <table.FlexRender cell={cell} />} {...props} />;
}

DataTableContent.displayName = "DataTable.Content";
DataTableHeader.displayName = "DataTable.Header";
DataTableBody.displayName = "DataTable.Body";
DataTableRow.displayName = "DataTable.Row";
