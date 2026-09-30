"use client";

import type { ReactElement, ReactNode } from "react";

import type { AppReactTable, Row, RowData, StockFeatures, TableState } from "@tanstack/react-table";

import { ContentTable, RowCells } from "./data-table";
import type { DataTableContentProps, DataTableRowProps } from "./data-table";
import {
  DataTableCurrency,
  DataTableDate,
  DataTableDateTime,
  DataTableNumber,
  DataTableText,
} from "./data-table-cells";
import type {
  DataTableCurrencyProps,
  DataTableDateProps,
  DataTableDateTimeProps,
  DataTableNumberProps,
  DataTableTextProps,
} from "./data-table-cells";
import { DataTableColumnToggle } from "./data-table-column-toggle";
import type { DataTableColumnToggleProps } from "./data-table-column-toggle";
import { fuseTableContexts } from "./data-table-contexts";
import { cellValueText } from "./data-table-format";
import type { CellValue } from "./data-table-format";
import { DataTablePagination } from "./data-table-pagination";
import type { DataTablePaginationProps } from "./data-table-pagination";
import { DataTableSortButton } from "./data-table-sort-button";
import type { DataTableSortButtonProps } from "./data-table-sort-button";
import type { NoComponents } from "./data-table-source";

/** A row of any table built through `createFuseTableHook`, as the registered parts read it. */
type ContextRow = Row<StockFeatures, RowData>;

/**
 * The table the Fuse context carries, with the `App*` wrappers `useAppTable` attaches and the
 * registered `Row`, Fuse's or an app's compatible replacement.
 */
type ContextTable = AppReactTable<
  StockFeatures,
  RowData,
  TableState<StockFeatures>,
  { Row: (props: RegisteredRowProps<ContextRow>) => ReactNode },
  NoComponents,
  NoComponents
>;

function useContextTable(): ContextTable {
  // SAFETY: only the AppTable that `createFuseTableHook`'s `useAppTable` returns provides this
  // context, and its value is that table with AppTable, AppHeader, AppCell and AppFooter attached,
  // and with the merged table registry, which always holds a `Row`: Fuse's, or an app's that
  // `createFuseTableHook`'s `TableRegistry` constraint holds to `RegisteredRowProps`.
  return fuseTableContexts.useTableContext() as ContextTable;
}

/** Props of the registered `table.Row`. */
export type RegisteredRowProps<TRow> = Omit<DataTableRowProps<never>, "table" | "row"> & {
  /** The row to render, from `table.Content`'s row takeover. */
  row: TRow;
};

/**
 * `table.Row`: `DataTable.Row` with every cell rendered through `table.AppCell`, so a column
 * definition can use the registered cells. It renders inside `table.Content`'s row takeover, whose
 * store subscription re-renders every row, so it subscribes to nothing itself.
 */
export function RegisteredRow({ row, ...props }: RegisteredRowProps<ContextRow>): ReactElement {
  const table = useContextTable();
  return (
    <RowCells
      row={row}
      renderCell={(cell) => <table.AppCell cell={cell}>{(appCell) => <appCell.FlexRender />}</table.AppCell>}
      {...props}
    />
  );
}

/** Props of the registered `table.Content`. */
export type RegisteredContentProps<TRow> = Omit<DataTableContentProps<never, never>, "table" | "children"> & {
  /** Takes over row rendering, for example to render `table.Row` with `onPress`. */
  children?: (row: TRow) => ReactNode;
};

/**
 * `table.Content`: `DataTable.Content` with every header rendered through `table.AppHeader` and
 * every cell through `table.AppCell`, so a column definition can use `header.SortButton` and the
 * registered cells. The row model depends on every state slice, so it subscribes to all of them
 * and stays current when the app's `useFuseTable` selector narrows `table.state`.
 */
export function RegisteredContent({ children, ...props }: RegisteredContentProps<ContextRow>): ReactElement {
  const table = useContextTable();
  return (
    <table.Subscribe source={table.store} selector={(state) => state}>
      {() => (
        <ContentTable
          table={table}
          renderHeader={(header) => (
            <table.AppHeader header={header}>{(appHeader) => <appHeader.FlexRender />}</table.AppHeader>
          )}
          renderRow={children ?? ((row) => <table.Row row={row} />)}
          {...props}
        />
      )}
    </table.Subscribe>
  );
}

/** Props of the registered `table.Pagination`. */
export type RegisteredPaginationProps = Omit<DataTablePaginationProps, "table">;

/**
 * `table.Pagination`: `DataTable.Pagination`, subscribed to the pagination state and the page
 * count. Filtering changes the count without a pagination update when the page index is already 0.
 */
export function RegisteredPagination(props: RegisteredPaginationProps): ReactElement {
  const table = useContextTable();
  return (
    <table.Subscribe
      source={table.store}
      selector={(state) => ({ pagination: state.pagination, pageCount: table.getPageCount() })}>
      {() => <DataTablePagination table={table} {...props} />}
    </table.Subscribe>
  );
}

/** Props of the registered `table.ColumnToggle`. */
export type RegisteredColumnToggleProps<TColumn> = Omit<
  DataTableColumnToggleProps<never>,
  "table" | "getLabel"
> & {
  /** A column's menu label. Defaults to the column id. */
  getLabel?: (column: TColumn) => ReactNode;
};

/** `table.ColumnToggle`: `DataTable.ColumnToggle`, subscribed to the visibility state. */
export function RegisteredColumnToggle(
  props: RegisteredColumnToggleProps<ReturnType<ContextTable["getAllLeafColumns"]>[number]>
): ReactElement {
  const table = useContextTable();
  return (
    <table.Subscribe source={table.atoms.columnVisibility}>
      {() => <DataTableColumnToggle table={table} {...props} />}
    </table.Subscribe>
  );
}

/** Props of the registered `header.SortButton`. */
export type RegisteredSortButtonProps = Omit<DataTableSortButtonProps, "column">;

/** `header.SortButton`: `DataTable.SortButton` for the header in context, subscribed to sorting. */
export function RegisteredSortButton(props: RegisteredSortButtonProps): ReactElement {
  const table = useContextTable();
  const header = fuseTableContexts.useHeaderContext();
  return (
    <table.Subscribe source={table.atoms.sorting}>
      {() => <DataTableSortButton column={header.column} {...props} />}
    </table.Subscribe>
  );
}

/** Props of the registered `cell.TextCell`. */
export type TextCellProps = Omit<DataTableTextProps, "value">;
/** Props of the registered `cell.NumberCell`. */
export type NumberCellProps = Omit<DataTableNumberProps, "value">;
/** Props of the registered `cell.CurrencyCell`. */
export type CurrencyCellProps = Omit<DataTableCurrencyProps, "value">;
/** Props of the registered `cell.DateCell`. */
export type DateCellProps = Omit<DataTableDateProps, "value">;
/** Props of the registered `cell.DateTimeCell`. */
export type DateTimeCellProps = Omit<DataTableDateTimeProps, "value">;

/**
 * Parse the cell in context. `getValue()` is TanStack's untyped boundary: a registered cell is
 * typed on every column whatever its value type, so the value is only known here, at runtime.
 */
function useCellValue(): CellValue {
  const value = fuseTableContexts.useCellContext().getValue();
  if (value instanceof Date) {
    return { kind: "date", value };
  }
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- getValue() is untyped per column; this is the parse at that boundary
  switch (typeof value) {
    case "number":
      return { kind: "number", value };
    case "string":
      return { kind: "text", value };
    case "boolean":
    case "bigint":
      return { kind: "text", value: String(value) };
    default:
      // null, undefined, objects, symbols and functions have no text of their own.
      return { kind: "text", value: "" };
  }
}

/** A cell value of another kind than the cell formats, as its raw text. */
function RawText({ cell, className }: { cell: CellValue; className?: string }): ReactElement {
  return <DataTableText value={cellValueText(cell)} className={className} />;
}

/** `cell.TextCell`: the cell value as text. */
export function TextCell(props: TextCellProps): ReactElement {
  return <DataTableText value={cellValueText(useCellValue())} {...props} />;
}

/**
 * `cell.NumberCell`: `DataTable.Number` over the cell value; any other value renders as raw text.
 * The registered cells are exported so an app can tweak one with a pure wrapper,
 * `(props) => <NumberCell maximumFractionDigits={0} {...props} />`, and register it under the same
 * key. Render them only inside `table.AppCell`, as the registry does.
 */
export function NumberCell(props: NumberCellProps): ReactElement {
  const cell = useCellValue();
  return cell.kind === "number" ? (
    <DataTableNumber value={cell.value} {...props} />
  ) : (
    <RawText cell={cell} className={props.className} />
  );
}

/** `cell.CurrencyCell`: `DataTable.Currency` over the cell value; any other value renders as raw text. */
export function CurrencyCell(props: CurrencyCellProps): ReactElement {
  const cell = useCellValue();
  return cell.kind === "number" ? (
    <DataTableCurrency value={cell.value} {...props} />
  ) : (
    <RawText cell={cell} className={props.className} />
  );
}

/** `cell.DateCell`: `DataTable.Date` over the cell value; any other value renders as raw text. */
export function DateCell(props: DateCellProps): ReactElement {
  const cell = useCellValue();
  return cell.kind === "date" ? (
    <DataTableDate value={cell.value} {...props} />
  ) : (
    <RawText cell={cell} className={props.className} />
  );
}

/** `cell.DateTimeCell`: `DataTable.DateTime` over the cell value; any other value renders as raw text. */
export function DateTimeCell(props: DateTimeCellProps): ReactElement {
  const cell = useCellValue();
  return cell.kind === "date" ? (
    <DataTableDateTime value={cell.value} {...props} />
  ) : (
    <RawText cell={cell} className={props.className} />
  );
}

RegisteredContent.displayName = "table.Content";
RegisteredRow.displayName = "table.Row";
RegisteredPagination.displayName = "table.Pagination";
RegisteredColumnToggle.displayName = "table.ColumnToggle";
RegisteredSortButton.displayName = "header.SortButton";
TextCell.displayName = "cell.TextCell";
NumberCell.displayName = "cell.NumberCell";
CurrencyCell.displayName = "cell.CurrencyCell";
DateCell.displayName = "cell.DateCell";
DateTimeCell.displayName = "cell.DateTimeCell";
