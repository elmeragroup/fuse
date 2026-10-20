"use client";

import { Children } from "react";
import type { ComponentProps, ReactElement } from "react";

import { ItemFooter } from "../item/item-markup";

/**
 * Footer band rendered **outside** the row label. Direct `SelectionItem.SubSection`
 * children are partitioned by identity (`child.type === SelectionItem.SubSection`); a
 * Fragment, wrapper, or HOC hides the part from that filter and it stays inside the
 * label, so clicks would toggle the control.
 */
export function SelectionItemSubSection({
  children,
  className,
  mode = "default",
  ...props
}: ComponentProps<typeof ItemFooter>): ReactElement | null {
  if (Children.toArray(children).length === 0) {
    return null;
  }
  return (
    <ItemFooter mode={mode} className={className} {...props}>
      {children}
    </ItemFooter>
  );
}

SelectionItemSubSection.displayName = "SelectionItem.SubSection";
