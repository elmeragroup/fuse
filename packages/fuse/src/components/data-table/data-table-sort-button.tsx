"use client";

import type { ReactElement, ReactNode } from "react";

import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { CaretUpDown } from "../../icons/generated/caret-up-down";
import { cn } from "../../styles/cn";
import { Button } from "../button/button";
import type { ButtonProps } from "../button/button";
import type { SortColumnSource } from "./data-table-source";
import { dataTableVariants } from "./data-table-variants";

const { sortButton, sortIcon } = dataTableVariants();

/** Props for `DataTable.SortButton`. */
export type DataTableSortButtonProps = Omit<ButtonProps, "children" | "onClick" | "size" | "aria-label"> & {
  /** The header's column, from a table with `rowSortingFeature`. */
  column: SortColumnSource;
  /** The column label. */
  children: ReactNode;
};

const SORT_ICONS = { asc: CaretUp, desc: CaretDown, none: CaretUpDown } as const;

/**
 * A column header's sort toggle: a ghost button with the label and a direction icon that calls
 * the column's sorting handler. A column that cannot sort renders the plain label. The `<th>` owns
 * `aria-sort`, which `DataTable.Header` sets, so the button does not repeat it.
 */
export function DataTableSortButton({
  column,
  children,
  className,
  variant = "ghost",
  ...props
}: DataTableSortButtonProps): ReactElement {
  const toggle = column.getToggleSortingHandler();
  if (!column.getCanSort() || toggle === undefined) {
    return <>{children}</>;
  }
  const Icon = SORT_ICONS[column.getIsSorted() || "none"];
  return (
    <Button
      data-slot="data-table-sort-button"
      variant={variant}
      size="sm"
      className={cn(sortButton(), className)}
      onClick={toggle}
      {...props}>
      {children}
      <Icon aria-hidden="true" data-icon="inline-end" className={sortIcon()} />
    </Button>
  );
}

DataTableSortButton.displayName = "DataTable.SortButton";
