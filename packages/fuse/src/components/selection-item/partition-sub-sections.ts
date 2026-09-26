/**
 * Splits a row's children into row content and `SelectionItem.SubSection` bands where the
 * elements were created. Directive-free so CheckboxItem and RadioItem can run it on the
 * server, where a SubSection's type is still the cached client reference; the shell's own
 * `child.type` filter only works for elements created on the client.
 */
import { Children, isValidElement } from "react";
import type { ReactNode } from "react";

import { SelectionItemSubSection } from "./selection-item";

/** A row's children split for `SelectionItem.Shell`: label content and outside bands. */
type PartitionedRowChildren = {
  /** Children rendered inside the row label. */
  readonly row: ReactNode[];
  /** `SelectionItem.SubSection` children, passed to the shell's `subSections` prop. */
  readonly subSections: ReactNode[];
};

/**
 * Partition direct children by `SelectionItem.SubSection` identity, keeping their order.
 *
 * @param children - The row's children, as the caller received them.
 * @returns `row` for the label content and `subSections` for the bands rendered outside it.
 */
export function partitionSubSections(children: ReactNode): PartitionedRowChildren {
  const row: ReactNode[] = [];
  const subSections: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    (isValidElement(child) && child.type === SelectionItemSubSection ? subSections : row).push(child);
  }
  return { row, subSections };
}
