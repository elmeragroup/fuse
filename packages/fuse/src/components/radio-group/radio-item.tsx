/**
 * `RadioItem` uses no hooks, so this module has no directive. A server component runs it and
 * reads `RadioItem.Title` and the other parts, and it renders `RadioGroupItem` and
 * `SelectionItem.Shell` as client references. The shell partitions the SubSections, as
 * `partitionSubSections` describes.
 */
import type { ReactElement, ReactNode } from "react";

import { SelectionItem } from "../selection-item";
import { SelectionItemShell } from "../selection-item/selection-item";
import type { SelectionItemRootProps } from "../selection-item/selection-item";
import { RadioGroupItem } from "./radio-group";

export type RadioItemProps = SelectionItemRootProps & {
  /** The value the group takes when this row is selected. */
  value: string;
  /**
   * Disables the radio, which dims to 50%, and shows the disabled row. The row fills with the
   * theme's `--selection-disabled-background` under `--selection-disabled-hatch` stripes, and
   * shows the `not-allowed` cursor. Neutral themes stripe a muted fill, and branded themes keep
   * the card fill with no stripes. The row's text, its SubSection's included, takes
   * `--selection-disabled-foreground`, which is the muted foreground in branded themes. A text
   * colour class on the row still wins. A disabled group shows its rows the same way.
   */
  isDisabled?: boolean;
  /** Where the radio sits in the row: before the content, or after it at `end`. */
  controlPosition?: "start" | "end";
  /**
   * Extra classes for the row. A `px-*` utility sets the card's side inset, and a click in that
   * inset beside the label row selects the radio. The row paints the card fill (`bg-card`),
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
   * Lets a click on a SubSection's text, band or side padding select the radio, while links,
   * buttons, fields and other focusable elements in it keep their own clicks. The radio's name
   * stays the label row. Leave it off when the SubSection reveals fields under the radio, so a
   * click between those fields does not change the choice.
   */
  isSubSectionSelectable?: boolean;
  /**
   * The row's content: `RadioItem.Content` with a `Title` and a `Description`, then
   * `RadioItem.Actions`. Direct `RadioItem.SubSection` children render below the label row,
   * outside the label, so a field or button in one never selects the row. A server component
   * may write these children and pass them to a client component that renders the `RadioItem`.
   * In a client component, a Fragment or wrapper around a SubSection hides it from the row and
   * keeps it inside the label.
   */
  children?: ReactNode;
};

/**
 * A labeled radio row built on `SelectionItem.Shell`. A server component can render it. The
 * parts `Title`, `Description`, `Content`, `Actions` and `SubSection` are the same objects as
 * `SelectionItem`'s, so the row recognises either spelling. Other attributes, such as `id`,
 * `data-testid` or a `data-*` hook, land on the row's `Field.Item` root, the element that
 * carries the row's `data-slot`.
 */
export function RadioItem({
  value,
  isDisabled,
  controlPosition = "start",
  className,
  isSubSectionSelectable = false,
  children,
  ...props
}: RadioItemProps): ReactElement {
  return (
    <SelectionItemShell
      dataSlot="radio-item"
      isDisabled={isDisabled}
      controlPosition={controlPosition}
      className={className}
      isSubSectionSelectable={isSubSectionSelectable}
      control={<RadioGroupItem value={value} disabled={isDisabled} />}
      {...props}>
      {children}
    </SelectionItemShell>
  );
}

RadioItem.displayName = "RadioItem";

RadioItem.Title = SelectionItem.Title;
RadioItem.Description = SelectionItem.Description;
RadioItem.Content = SelectionItem.Content;
RadioItem.Actions = SelectionItem.Actions;
RadioItem.SubSection = SelectionItem.SubSection;
