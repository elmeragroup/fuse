"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { SlidersHorizontal } from "../../icons/generated/sliders-horizontal";
import { definedProps } from "../../internal/defined-props";
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
  /**
   * Whether the menu is open. Pass it with `onOpenChange` to control the menu, for example to
   * close it when the host hides the table.
   */
  open?: boolean;
  /** Whether the menu starts open when `open` is not passed. Defaults to `false`. */
  defaultOpen?: boolean;
  /** Called with the next open state and Base UI's change details when the menu opens or closes. */
  onOpenChange?: ComponentProps<typeof DropdownMenuRoot>["onOpenChange"];
};

/**
 * A menu of checkbox items that shows and hides every column whose `getCanHide()` is true.
 * `open`, `defaultOpen` and `onOpenChange` go to the menu; the other props go to its trigger.
 */
export function DataTableColumnToggle<TColumn extends VisibilityColumnSource>({
  table,
  getLabel,
  label,
  variant = "outline",
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: DataTableColumnToggleProps<TColumn>): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  return (
    <DropdownMenuRoot {...definedProps({ open, defaultOpen, onOpenChange })}>
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
