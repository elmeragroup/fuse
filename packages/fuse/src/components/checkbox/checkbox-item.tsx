/**
 * Server-visible `CheckboxItem`. The row is hook-free, so this module has no directive:
 * a server component runs it and reads `CheckboxItem.Title` and the other parts, while
 * `Checkbox` and `SelectionItem.Shell` stay client references it renders. It partitions
 * its own SubSections (see `partitionSubSections`) and passes them to the shell.
 */
import type { ReactElement, ReactNode } from "react";

import { SelectionItem } from "../selection-item";
import { partitionSubSections } from "../selection-item/partition-sub-sections";
import { SelectionItemShell } from "../selection-item/selection-item";
import { Checkbox } from "./checkbox";

type CheckboxItemBaseProps = {
  /** Forwards `disabled` to the inner Checkbox and applies disabled hatch styling on the shell. */
  isDisabled?: boolean;
  /** Forwards `readOnly` to the inner Checkbox. */
  isReadOnly?: boolean;
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
   * Lets a click on a SubSection's text, band or side padding toggle the control, while
   * links, buttons, fields and other focusable elements in it keep their own clicks.
   * Forwarded to `SelectionItem.Shell`; see it there. Leave it off when the SubSection
   * reveals fields under the control. Default `false`.
   */
  isSubSectionSelectable?: boolean;
  /**
   * Row children, partitioned by the row. Direct `CheckboxItem.SubSection` (the
   * same object as `SelectionItem.SubSection`) children render outside the label.
   */
  children?: ReactNode;
};

/**
 * Discriminated parent-vs-value union. Parent rows derive tri-state from the
 * group's `allValues` and must not set `value`.
 */
export type CheckboxItemProps = CheckboxItemBaseProps &
  (
    | {
        /** Member value in the group. Required unless `parent`. */
        value: string;
        /** When true, this row is the tri-state parent. Incompatible with `value`. */
        parent?: false;
      }
    | {
        /** Tri-state parent — checked/indeterminate/unchecked from the group's `allValues`. */
        parent: true;
        /** Parent rows must not set `value`. */
        value?: never;
      }
  );

/**
 * Labeled selection row over `SelectionItem.Shell`. Server-compatible: it renders the
 * client `SelectionItem.Shell`, which wires Field.Item and the label. The namespace
 * aliases `Title`, `Description`, `Content`, `Actions` and `SubSection` are the exact
 * `SelectionItem.*` objects, so `child.type` partitioning works with either spelling.
 */
export function CheckboxItem({
  value,
  parent,
  isDisabled,
  isReadOnly,
  controlPosition = "start",
  className,
  isSubSectionSelectable,
  children,
}: CheckboxItemProps): ReactElement {
  const { row, subSections } = partitionSubSections(children);
  return (
    <SelectionItemShell
      dataSlot="checkbox-item"
      isDisabled={isDisabled}
      controlPosition={controlPosition}
      className={className}
      isSubSectionSelectable={isSubSectionSelectable}
      control={
        parent === true ? (
          <Checkbox parent disabled={isDisabled} readOnly={isReadOnly} />
        ) : (
          <Checkbox value={value} disabled={isDisabled} readOnly={isReadOnly} />
        )
      }
      subSections={subSections}>
      {row}
    </SelectionItemShell>
  );
}

CheckboxItem.displayName = "CheckboxItem";

CheckboxItem.Title = SelectionItem.Title;
CheckboxItem.Description = SelectionItem.Description;
CheckboxItem.Content = SelectionItem.Content;
CheckboxItem.Actions = SelectionItem.Actions;
CheckboxItem.SubSection = SelectionItem.SubSection;
