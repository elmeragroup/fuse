"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";
import { Skeleton } from "../skeleton/skeleton";
import { TableCell } from "./table-cell";
import { TABLE_CELL_CLASSES } from "./table-cell-classes";
import { verticalTableCellText } from "./vertical-table-cell-text";

/** `VerticalTable.Key` takes a native `td`'s props, its text wrapping, a loading state and `render`. */
export type VerticalTableKeyProps = ComponentProps<"td"> & {
  /** `"truncate"` clips text that overflows the cell; `"default"` wraps it. */
  text?: "default" | "truncate";
  /** Shows a skeleton in place of the children while the key loads. */
  isLoading?: boolean;
  /**
   * Replaces the `<td>`. Pass `render={<th scope="row" />}` to make the key the row's header. The
   * key's classes stay on the replacement.
   */
  render?: useRender.RenderProp;
};

/**
 * The muted key column, its text at the inline start whether it renders a `td` or a row-header
 * `th`. It is a client module because `render` goes through `useRender`; the rest of the compound
 * stays server-safe.
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
            "text-sm font-medium *:text-sm **:text-sm group-data-[font-weight=bold]/vertical-table-row-item:font-medium group-data-[font-weight=normal]/vertical-table-row-item:font-normal bg-muted/50 text-start",
            "in-data-[variant=non-bordered-compact]:border-none in-data-[variant=non-bordered-compact]:bg-inherit in-data-[variant=non-bordered-compact]:py-1 in-data-[variant=non-bordered-compact]:[--table-cell-pe:0px] in-data-[variant=non-bordered-compact]:[--table-cell-ps:0px]",
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
