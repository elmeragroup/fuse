/**
 * `CheckboxItem` uses no hooks, so this module has no directive. A server component runs it and
 * reads `CheckboxItem.Title` and the other parts, and it renders `Checkbox` and
 * `SelectionItem.Shell` as client references. The shell partitions the SubSections, as
 * `partitionSubSections` describes.
 */
import type { ReactElement, ReactNode } from "react";

import { SelectionItem } from "../selection-item";
import { SelectionItemShell } from "../selection-item/selection-item";
import type { SelectionItemRootProps } from "../selection-item/selection-item";
import { Checkbox } from "./checkbox";

type CheckboxItemBaseProps = SelectionItemRootProps & {
  /**
   * Disables the checkbox, which dims to 50%, and shows the disabled row. The row fills with the
   * theme's `--selection-disabled-background` under `--selection-disabled-hatch` stripes, and
   * shows the `not-allowed` cursor. Neutral themes stripe a muted fill, and branded themes keep
   * the card fill with no stripes. The row's text, its SubSection's included, takes
   * `--selection-disabled-foreground`, which is the muted foreground in branded themes. A text
   * colour class on the row still wins. A disabled group shows its rows the same way.
   */
  isDisabled?: boolean;
  /** Makes the checkbox read-only: it shows its state but a click does not change it. */
  isReadOnly?: boolean;
  /** Where the checkbox sits in the row: before the content, or after it at `end`. */
  controlPosition?: "start" | "end";
  /**
   * Extra classes for the row. A `px-*` utility sets the card's side inset, and a click in that
   * inset beside the label row toggles the checkbox. The row paints the card fill (`bg-card`),
   * and a background class such as `bg-background` replaces it.
   * The row states its fill as `--surface`, the colour a chart's cut-outs paint, so a row that
   * paints another opaque fill restates `--surface` and `--surface-muted-foreground` beside it, such
   * as `className="bg-background [--surface:var(--background)] [--surface-muted-foreground:var(--muted-foreground)]"`.
   * The checked row's `bg-muted` tint and the disabled row's `--selection-disabled-background`
   * fill win over such a class. Set `--selection-disabled-background`, for example to
   * `var(--background)`, to change the disabled fill.
   *
   * The edges and the lines between rows come from the `--selection-*` theme roles, which the
   * Tokens section lists. Set a role on the element that carries the theme attributes, `<html>`
   * or a `ThemeScope`. For example, `--selection-border: var(--border)` on the `ThemeScope`
   * gives branded rows an outer edge. On a plain wrapper the rows keep the edges the theme
   * element resolved.
   */
  className?: string;
  /**
   * Lets a click on a SubSection's text, band or side padding toggle the checkbox, while links,
   * buttons, fields and other focusable elements in it keep their own clicks. The checkbox's
   * name stays the label row. Leave it off when the SubSection reveals fields under the
   * checkbox, so a click between those fields does not clear the choice.
   */
  isSubSectionSelectable?: boolean;
  /**
   * The row's content: `CheckboxItem.Content` with a `Title` and a `Description`, then
   * `CheckboxItem.Actions`. Direct `CheckboxItem.SubSection` children render below the label
   * row, outside the label, so a field or button in one never toggles the row. A server
   * component may write these children and pass them to a client component that renders the
   * `CheckboxItem`. In a client component, a Fragment or wrapper around a SubSection hides it
   * from the row and keeps it inside the label.
   */
  children?: ReactNode;
};

/**
 * A member row sets `value`. A `parent` row sets no `value` and takes its state from the
 * group's `allValues`.
 */
export type CheckboxItemProps = CheckboxItemBaseProps &
  (
    | {
        /** The value the row adds to the group's selection. Every row but a `parent` needs one. */
        value: string;
        /**
         * Makes the row the group's parent checkbox, which checks and unchecks every member
         * and is indeterminate while some are checked. A parent row sets no `value`.
         */
        parent?: false;
      }
    | {
        /**
         * Makes the row the group's parent checkbox, which checks and unchecks every member
         * and is indeterminate while some are checked. A parent row sets no `value`.
         */
        parent: true;
        /** A parent row sets no `value`. */
        value?: never;
      }
  );

/**
 * A labeled checkbox row built on `SelectionItem.Shell`. A server component can render it. The
 * parts `Title`, `Description`, `Content`, `Actions` and `SubSection` are the same objects as
 * `SelectionItem`'s, so the row recognises either spelling. Other attributes, such as `id`,
 * `data-testid` or a `data-*` hook, land on the row's `Field.Item` root, the element that
 * carries the row's `data-slot`.
 */
export function CheckboxItem({
  value,
  parent,
  isDisabled,
  isReadOnly,
  controlPosition = "start",
  className,
  isSubSectionSelectable = false,
  children,
  ...props
}: CheckboxItemProps): ReactElement {
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
      {...props}>
      {children}
    </SelectionItemShell>
  );
}

CheckboxItem.displayName = "CheckboxItem";

CheckboxItem.Title = SelectionItem.Title;
CheckboxItem.Description = SelectionItem.Description;
CheckboxItem.Content = SelectionItem.Content;
CheckboxItem.Actions = SelectionItem.Actions;
CheckboxItem.SubSection = SelectionItem.SubSection;
