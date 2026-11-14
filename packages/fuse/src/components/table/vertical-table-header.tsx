"use client";

import type { ComponentProps, ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { cn } from "../../styles/cn";

/** `VerticalTable.Header` takes a native `h2`'s props and a `render` replacement. */
export type VerticalTableHeaderProps = ComponentProps<"h2"> & {
  /**
   * Replaces the `<h2>`, such as `render={<h3 />}` for another outline level. The level-2 type
   * classes stay on the replacement.
   */
  render?: useRender.RenderProp;
};

/**
 * The facts sheet's heading, an `<h2>` in the level-2 type. It is a client module because `render`
 * goes through `useRender`; the rest of the compound stays server-safe.
 */
export function VerticalTableHeader({ className, render, ...props }: VerticalTableHeaderProps): ReactElement {
  return useRender({
    defaultTagName: "h2",
    props: {
      "data-slot": "vertical-table-header",
      ...mergeProps<"h2">(
        {
          className: cn("text-lg leading-snug font-medium font-heading text-inherit", className),
        },
        props
      ),
    },
    render,
  });
}

VerticalTableHeader.displayName = "VerticalTable.Header";
