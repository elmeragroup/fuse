/**
 * Server-visible `RadioItem`. The row is hook-free, so this module has no directive:
 * a server component runs it and reads `RadioItem.Title` and the other parts, while
 * `RadioGroupItem` and `SelectionItem.Shell` stay client references it renders. It partitions
 * its own SubSections (see `partitionSubSections`) and passes them to the shell.
 */
import type { ReactElement, ReactNode } from "react";

import { SelectionItem } from "../selection-item";
import { partitionSubSections } from "../selection-item/partition-sub-sections";
import { SelectionItemShell } from "../selection-item/selection-item";
import { RadioGroupItem } from "./radio-group";

export type RadioItemProps = {
  /** Member value in the group. Forwarded to the inner `RadioGroupItem`. */
  value: string;
  /** Forwards `disabled` to the inner control and applies disabled hatch styling on the shell. */
  isDisabled?: boolean;
  /**
   * Where the control sits in the labelled row. Forwarded to `SelectionItem.Shell`.
   * Default `"start"`.
   */
  controlPosition?: "start" | "end";
  /**
   * Extra classes, merged onto the shell via `cn`. A `px-*` utility sets the card's side
   * inset, and a click in that inset beside the label row toggles the control. The row
   * paints the card fill (`bg-card`); a background class such as `bg-background` replaces it.
   */
  className?: string;
  /**
   * Row children, partitioned by the row. Direct `RadioItem.SubSection` (the
   * same object as `SelectionItem.SubSection`) children render outside the label.
   */
  children?: ReactNode;
};

/**
 * Labeled selection row over `SelectionItem.Shell`. Server-compatible: it renders the
 * client `SelectionItem.Shell`, which wires Field.Item and the label. The namespace
 * aliases `Title`, `Description`, `Content`, `Actions` and `SubSection` are the exact
 * `SelectionItem.*` objects, so `child.type` partitioning works with either spelling.
 */
export function RadioItem({
  value,
  isDisabled,
  controlPosition = "start",
  className,
  children,
}: RadioItemProps): ReactElement {
  const { row, subSections } = partitionSubSections(children);
  return (
    <SelectionItemShell
      dataSlot="radio-item"
      isDisabled={isDisabled}
      controlPosition={controlPosition}
      className={className}
      control={<RadioGroupItem value={value} disabled={isDisabled} />}
      subSections={subSections}>
      {row}
    </SelectionItemShell>
  );
}

RadioItem.displayName = "RadioItem";

RadioItem.Title = SelectionItem.Title;
RadioItem.Description = SelectionItem.Description;
RadioItem.Content = SelectionItem.Content;
RadioItem.Actions = SelectionItem.Actions;
RadioItem.SubSection = SelectionItem.SubSection;
