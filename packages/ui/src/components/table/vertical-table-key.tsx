"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";
import { Skeleton } from "../skeleton/skeleton";
import { TableCell } from "./table-cell";
import { TABLE_CELL_CLASSES } from "./table-cell-classes";
import { verticalTableCellText } from "./vertical-table-cell-text";

export type VerticalTableKeyProps = ComponentProps<"td"> & {
  /**
   * `"truncate"` clips overflowing text; `"default"` wraps (`whitespace-normal`).
   */
  text?: "default" | "truncate";
  /**
   * Replaces children with a `Skeleton` (`h-4 w-full max-w-24`).
   */
  isLoading?: boolean;
  /**
   * Replaces the host `<td>` via base-ui `useRender`. Pass `render={<th scope="row" />}`
   * for row-header semantics; Key classes and `data-slot` stay merged onto the host.
   */
  render?: useRender.RenderProp;
};

/**
 * Muted key column. Client only because polymorphism is `useRender`;
 * the rest of the compound stays server.
 */
export function VerticalTableKey({
  children,
  className,
  text = "truncate",
  isLoading = false,
  render,
  ...props
}: VerticalTableKeyProps): ReactElement {
  return useRender({
    defaultTagName: "td",
    props: {
      "data-slot": "table-cell",
      ...mergeProps<"td">(
        {
          className: cn(
            TABLE_CELL_CLASSES,
            "text-sm font-medium *:text-sm **:text-sm group-data-[font-weight=bold]/vertical-table-row-item:font-medium group-data-[font-weight=normal]/vertical-table-row-item:font-normal bg-muted/50 py-2",
            "in-data-[variant=non-bordered-compact]:border-none in-data-[variant=non-bordered-compact]:bg-inherit in-data-[variant=non-bordered-compact]:px-0 in-data-[variant=non-bordered-compact]:py-1",
            verticalTableCellText(text),
            className
          ),
        },
        props
      ),
      children: isLoading ? (
        <Skeleton className="h-4 w-full max-w-24 in-data-[variant=non-bordered-compact]:h-lh" />
      ) : (
        children
      ),
    },
    render: render ?? <TableCell />,
  });
}

VerticalTableKey.displayName = "VerticalTable.Key";
