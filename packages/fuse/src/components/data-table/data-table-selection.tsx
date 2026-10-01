"use client";

import type { ComponentProps, ReactElement } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { Checkbox } from "../checkbox/checkbox";
import type { SelectAllSource, SelectRowSource } from "./data-table-source";
import { dataTableStrings } from "./intl";

type CheckboxProps = ComponentProps<typeof Checkbox>;

/** Props for `DataTable.SelectAll`. */
export type DataTableSelectAllProps = Omit<
  CheckboxProps,
  "checked" | "defaultChecked" | "indeterminate" | "onCheckedChange"
> & {
  /** The table, from `useTable` with `rowSelectionFeature`. */
  table: SelectAllSource;
  /** Accessible name. Defaults to the locale dictionary. */
  label?: string;
};

/**
 * The header checkbox that selects every row on the current page. It is page-scoped because, with
 * server paging, "all" cannot mean rows that have not loaded. It shows the indeterminate state
 * while some but not all page rows are selected.
 */
export function DataTableSelectAll({ table, label, ...props }: DataTableSelectAllProps): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  const all = table.getIsAllPageRowsSelected();
  return (
    <Checkbox
      data-slot="data-table-select-all"
      aria-label={label ?? strings.format("selectAllOnPage")}
      checked={all}
      indeterminate={!all && table.getIsSomePageRowsSelected()}
      onCheckedChange={(checked) => {
        table.toggleAllPageRowsSelected(checked);
      }}
      {...props}
    />
  );
}

/** Props for `DataTable.SelectRow`. */
export type DataTableSelectRowProps = Omit<
  CheckboxProps,
  "checked" | "defaultChecked" | "indeterminate" | "onCheckedChange" | "aria-label"
> & {
  /** The row, from a table with `rowSelectionFeature`. */
  row: SelectRowSource;
  /** Accessible name, distinct per row, such as "Select order 4711". */
  label: string;
};

/** A row's selection checkbox. It is disabled when the row cannot be selected. */
export function DataTableSelectRow({
  row,
  label,
  disabled,
  ...props
}: DataTableSelectRowProps): ReactElement {
  return (
    <Checkbox
      data-slot="data-table-select-row"
      aria-label={label}
      checked={row.getIsSelected()}
      disabled={disabled === true || !row.getCanSelect()}
      onCheckedChange={(checked) => {
        row.toggleSelected(checked);
      }}
      {...props}
    />
  );
}

DataTableSelectAll.displayName = "DataTable.SelectAll";
DataTableSelectRow.displayName = "DataTable.SelectRow";
