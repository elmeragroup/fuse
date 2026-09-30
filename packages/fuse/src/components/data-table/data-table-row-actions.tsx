"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { DotsThree } from "../../icons/generated/dots-three";
import { Button } from "../button/button";
import { DropdownMenuContent, DropdownMenuRoot, DropdownMenuTrigger } from "../dropdown-menu/dropdown-menu";
import { dataTableVariants } from "./data-table-variants";
import { dataTableStrings } from "./intl";

const { actionsCell } = dataTableVariants();

/** Props for `DataTable.RowActions`. */
export type DataTableRowActionsProps = Omit<
  ComponentProps<typeof DropdownMenuTrigger>,
  "children" | "render"
> & {
  /** The trigger's accessible name, distinct per row, such as "Actions for order 4711". */
  label: string;
  /** The menu's items: `DropdownMenu.Item`, including `variant="destructive"`, and separators. */
  children: ReactNode;
};

/**
 * A row's actions menu: a ghost icon button holding the `DotsThree` icon, named by `label`, that
 * opens `children` in a `DropdownMenu` aligned to the trigger's end. Props other than `label` and
 * `children` land on the trigger. Clicks inside the open menu do not press a pressable row.
 */
export function DataTableRowActions({ label, children, ...props }: DataTableRowActionsProps): ReactElement {
  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger
        data-slot="data-table-row-actions"
        render={<Button variant="ghost" size="icon-sm" aria-label={label} />}
        {...props}>
        <DotsThree aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenuRoot>
  );
}

/**
 * Package-private header of the `actionsColumn` column: the localized word "Actions", visually
 * hidden, so the `<th>` has a name without visible text. Its `data-slot` shrinks the column.
 */
export function RowActionsHeader(): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  return (
    <span data-slot="data-table-actions-header" className="sr-only">
      {strings.format("actions")}
    </span>
  );
}

/**
 * Package-private cell of the `actionsColumn` column: `DataTable.RowActions`, right-aligned, whose
 * label the locale dictionary builds from the row's name.
 */
export function RowActionsCell({ name, children }: { name: string; children: ReactNode }): ReactElement {
  const strings = useLocalizedStrings(dataTableStrings);
  return (
    <div className={actionsCell()}>
      <DataTableRowActions label={strings.format("actionsFor", { name })}>{children}</DataTableRowActions>
    </div>
  );
}

DataTableRowActions.displayName = "DataTable.RowActions";
