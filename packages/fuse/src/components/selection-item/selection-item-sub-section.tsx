/** Directive-free so a server component renders it; see `partitionSubSections` for why. */
import { Children } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { ItemFooter } from "../item/item-markup";

/** The attribute every rendered SubSection root carries; `partitionSubSections` looks for it. */
export const SUB_SECTION_MARKER = "data-selection-item-sub-section";

/**
 * Whether a SubSection with these children renders. One without renders nothing and opens no band.
 *
 * @param children - The SubSection's children.
 * @returns `true` when there is at least one child to render.
 */
export function hasSubSectionContent(children: ReactNode): boolean {
  return Children.toArray(children).length > 0;
}

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
  if (!hasSubSectionContent(children)) {
    return null;
  }
  return (
    <ItemFooter mode={mode} className={className} {...props} data-selection-item-sub-section="">
      {children}
    </ItemFooter>
  );
}

SelectionItemSubSection.displayName = "SelectionItem.SubSection";
