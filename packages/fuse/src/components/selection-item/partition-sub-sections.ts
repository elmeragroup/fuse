/**
 * Splits a row's children into row content and `SelectionItem.SubSection` bands, wherever the
 * children were written.
 *
 * A SubSection written in a client component reaches the shell as an element of the part
 * itself. One written in a server component does not: the server already ran the
 * directive-free part, and the shell receives the root element it rendered, which carries
 * `SUB_SECTION_MARKER`. React Flight keeps an element's props, so the marker survives, while a
 * client reference's `type` reaches the client as an opaque lazy wrapper; the partition never
 * reads that wrapper's internals. This covers `SelectionItem.Shell` written in a server
 * component and `CheckboxItem` or `RadioItem` rendered by a client component around children a
 * server component passed it alike.
 */
import { Children, isValidElement } from "react";
import type { ReactNode } from "react";

import { SelectionItemSubSection, SUB_SECTION_MARKER } from "./selection-item-sub-section";

/** A row's children split for `SelectionItem.Shell`: label content and outside bands. */
type PartitionedRowChildren = {
  /** Children rendered inside the row label. */
  readonly row: ReactNode[];
  /** `SelectionItem.SubSection` children, rendered in the band outside the label. */
  readonly subSections: ReactNode[];
};

/**
 * Whether a child is a SubSection that renders: the part with children, or the root a server
 * component rendered from it. An empty SubSection renders nothing on either side, so it opens
 * no band.
 */
function isSubSection(child: ReactNode): boolean {
  if (!isValidElement<{ children?: ReactNode }>(child)) {
    return false;
  }
  if (child.type === SelectionItemSubSection) {
    return Children.toArray(child.props.children).length > 0;
  }
  return child.type === "div" && Object.hasOwn(child.props, SUB_SECTION_MARKER);
}

/**
 * Partition direct children into the label row and the SubSection band, keeping their order.
 *
 * @param children - The row's children, as the shell received them.
 * @returns `row` for the label content and `subSections` for the bands rendered outside it.
 */
export function partitionSubSections(children: ReactNode): PartitionedRowChildren {
  const row: ReactNode[] = [];
  const subSections: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    (isSubSection(child) ? subSections : row).push(child);
  }
  return { row, subSections };
}
