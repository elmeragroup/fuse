/**
 * `SelectionItem.SubSection` holds no state, so this module has no directive and a server
 * component runs it. That is what lets a row find its SubSections in a server tree: React
 * Flight revives a client reference as a lazy wrapper, so a `"use client"` SubSection would
 * reach the shell with an unrecognisable `type`, while a server-rendered one reaches it as its
 * root element, whose props cross Flight intact. See `partitionSubSections`.
 */
import { Children } from "react";
import type { ComponentProps, ReactElement } from "react";

import { ItemFooter } from "../item/item-markup";

/**
 * The attribute a SubSection's root always carries. The shell recognises a SubSection a server
 * component already rendered by it, since such an element's type is the root `div`, not this part.
 */
export const SUB_SECTION_MARKER = "data-selection-item-sub-section";

/**
 * Footer band rendered **outside** the row label. Direct `SelectionItem.SubSection` children
 * are partitioned out of the label row, whether a client or a server component wrote them. In
 * a client component a Fragment, wrapper or HOC hides the part from that partition and it
 * stays inside the label, so clicks would toggle the control. A SubSection with no children
 * renders nothing.
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
    <ItemFooter mode={mode} className={className} {...props} {...{ [SUB_SECTION_MARKER]: "" }}>
      {children}
    </ItemFooter>
  );
}

SelectionItemSubSection.displayName = "SelectionItem.SubSection";
