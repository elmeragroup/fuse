"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { SlidersHorizontal } from "../../icons/generated/sliders-horizontal";
import { Button } from "../button/button";
import type { ButtonProps } from "../button/button";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from "../dropdown-menu/dropdown-menu";
import type { ColumnToggleSource, VisibilityColumnSource } from "./data-table-source";
import { dataTableStrings } from "./intl";

/** Props for `DataTable.ColumnToggle`. */
export type DataTableColumnToggleProps<TColumn extends VisibilityColumnSource> = Omit<
  ComponentProps<typeof DropdownMenuTrigger>,
  "children" | "render"
> & {
  /** The trigger button's look. Defaults to `"outline"`. */
  variant?: ButtonProps["variant"];
  /** The table, from `useTable` with `columnVisibilityFeature`. */
  table: ColumnToggleSource<TColumn>;
  /**
   * A column's menu label. Defaults to the column id. Fuse reads no `columnDef.meta` field, since
   * augmenting TanStack's global `ColumnMeta` would clash with an app's own declaration.
   */
  getLabel?: (column: TColumn) => ReactNode;
  /** The trigger's visible text. Defaults to the locale dictionary. */
  label?: string;
};

/**
 * A menu of checkbox items that shows and hides every column whose `getCanHide()` is true.
 */
export function DataTableColumnToggle<TColumn extends VisibilityColumnSource>({
  table,
  getLabel,
  label,
  variant = "outline",
  ...props
}: DataTableColumnToggleProps<TColumn>): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        data-slot="data-table-column-toggle"
        render={<Button variant={variant} size="sm" />}
        {...props}>
        <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
        {label ?? strings.format("columns")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllLeafColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => {
                column.toggleVisibility(checked);
              }}>
              {getLabel?.(column) ?? column.id}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
}

DataTableColumnToggle.displayName = "DataTable.ColumnToggle";
