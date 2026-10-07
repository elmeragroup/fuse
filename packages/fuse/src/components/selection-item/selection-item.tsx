"use client";

import { Children, createContext, isValidElement, useContext, useMemo } from "react";
import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";

import { cn } from "../../styles/cn";
import { selectionItemShellClass } from "../../styles/inner-corner/item";
import { disabledHatch } from "../../styles/utils";
import { FieldItem } from "../field/field";
import { ItemGroup } from "../item/item";
import { ItemActions, ItemFooter, ItemMedia, ItemTitle } from "../item/item-markup";
import { itemVariants } from "../item/item-variants";
import { selectionGroupOrientationVariants } from "./selection-item-variants";
import type { SelectionItemGroupOrientation } from "./selection-item-variants";

/** Resolved once at module scope — the shell always borrows the `outline` arm. */
const outlineItemClass = itemVariants({ variant: "outline" });

// The label's `::before` is the row's click target. With automatic grid lines it covers the
// shell's padding box, so a row whose SubSections are all `mode="hidden"` toggles from its
// bottom inset like a plain row: the sub-section band keeps that 14px inset and lets clicks
// through to the target. Once the band holds a footer that shows, the target shrinks to the
// label row and the band takes its own clicks again, unless `isSubSectionSelectable` keeps the
// whole box. Child combinators keep a selection row nested in a SubSection from counting.
// Tailwind reads class names from the source text, so each selector is written out in full.
const labelClass = cn(
  "contents cursor-pointer before:absolute before:inset-0 before:-z-1 has-disabled:cursor-not-allowed"
);
const labelRowTargetClass = cn(
  "[[data-selection-item]:has(>[data-slot=selection-item-sub-sections]>div>[data-slot=item-footer]:not([data-mode=hidden]))>&]:before:row-[1/2]"
);
const subSectionBandClass = cn(
  "pointer-events-none col-span-full grid grid-cols-subgrid pb-3.5",
  "has-[>div>[data-slot=item-footer]:not([data-mode=hidden])]:pointer-events-auto"
);
// With `isSubSectionSelectable`, the band shows the label row's cursor, and the not-allowed one
// while the control is disabled.
const selectableBandClass = cn(
  "cursor-pointer [[data-selection-item]:has(>label>[data-slot=selection-item-control]_:disabled)>&]:cursor-not-allowed"
);

/**
 * Elements in a SubSection that keep their own clicks under `isSubSectionSelectable`. A click
 * inside one of them, or inside an element that only takes focus, does not toggle the row.
 */
const subSectionOwnClickSelector =
  "a, button, input, select, textarea, label, summary, audio[controls], video[controls], [contenteditable], [role=button], [role=link], [tabindex]";

/**
 * What a shell sits in: `false` outside any selection group; otherwise the enclosing
 * group's `orientation` plus whether that group is the private `role="list"` card list
 * (`list: true`) or the plain group primitive (`list: false`).
 */
type SelectionItemGroupContextValue = false | { orientation: SelectionItemGroupOrientation; list: boolean };

const SelectionItemGroupContext = createContext<SelectionItemGroupContextValue>(false);

type SelectionGroupLayoutProps = {
  children?: ReactNode;
  orientation: SelectionItemGroupOrientation;
};

/**
 * Package-private layout announcer that `CheckboxGroup` and `RadioGroup` wrap their
 * primitive's children in. A shell placed directly in a plain
 * group then follows the group's `orientation` for its edge treatment — connected stack
 * when vertical, individually rounded card when horizontal — instead of always
 * assuming a connected stack. It adds no `role`; only `SelectionItemGroup` is a list.
 */
export function SelectionGroupLayout({ children, orientation }: SelectionGroupLayoutProps): ReactElement {
  const value = useMemo(() => ({ orientation, list: false }), [orientation]);
  return <SelectionItemGroupContext.Provider value={value}>{children}</SelectionItemGroupContext.Provider>;
}

type SelectionItemGroupProps = {
  children?: ReactNode;
  /**
   * Layout of the actual item list. Vertical (default) is connected
   * `flex-col gap-0`. Horizontal is `flex-row flex-wrap gap-4`.
   */
  orientation?: SelectionItemGroupOrientation;
};

/**
 * Private stacked-card list wrapper. `Item.Group` still emits `role="list"`;
 * `SelectionItem.Shell` reads this context and defaults to `role="listitem"`.
 * Vertical remains a connected `flex-col gap-0` stack; horizontal is the actual
 * item list `flex-row flex-wrap gap-4` with individually rounded shells.
 * Not part of the public `SelectionItem` namespace or entry.
 */
export function SelectionItemGroup({
  children,
  orientation = "vertical",
}: SelectionItemGroupProps): ReactElement {
  const value = useMemo(() => ({ orientation, list: true }), [orientation]);
  return (
    <SelectionItemGroupContext.Provider value={value}>
      <ItemGroup className={cn("select-none", selectionGroupOrientationVariants({ orientation }).list())}>
        {children}
      </ItemGroup>
    </SelectionItemGroupContext.Provider>
  );
}

/**
 * The option's name. It takes the row's density type size, `--control-text-row`, in place of
 * `Item.Title`'s fixed `text-sm`. The size carries `leading-snug` as its `/snug` modifier: a
 * separate `leading-snug` before it would fall to tailwind-merge, which drops a line height
 * that comes before a font size, and the formatter sorts the classes inside a string.
 */
export function SelectionItemTitle({ className, ...props }: ComponentProps<typeof ItemTitle>): ReactElement {
  return (
    <ItemTitle className={cn("text-(length:--control-text-row)/snug font-normal", className)} {...props} />
  );
}

export function SelectionItemActions({
  className,
  ...props
}: ComponentProps<typeof ItemActions>): ReactElement {
  return <ItemActions className={cn("-translate-y-0.5 items-start", className)} {...props} />;
}

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

type SelectionItemShellProps = Omit<ComponentProps<typeof FieldItem>, "className" | "children"> & {
  /**
   * Emitted as `data-slot` on the `Field.Item` root. Typical values are
   * `"checkbox-item"` and `"radio-item"`.
   */
  dataSlot: string;
  /**
   * The selection control rendered in the `Item.Media variant="icon"` slot. Documented
   * escape hatch for custom indicators (switch, icon crossfade) that the dropped
   * external-card axes used to provide.
   */
  control: ReactNode;
  /**
   * Where the control sits in the labelled row. `"end"` places it after the row
   * children (trailing indicator). Default `"start"`.
   */
  controlPosition?: "start" | "end";
  /**
   * Applies `cursor-not-allowed bg-muted` plus the shared `disabledHatch` overlay.
   * Does not disable the control — the control or group owns that.
   */
  isDisabled?: boolean;
  /**
   * Extra classes, merged last through `cn`. A `px-*` utility sets the card's side inset,
   * and a click in that inset beside the label row toggles the control. The row paints the
   * card fill (`bg-card`) like the other field boxes; a list on a surface that should show
   * through takes a background class such as `bg-background`, which replaces it.
   */
  className?: string;
  /**
   * Sub-sections the caller already partitioned out of its row children, rendered outside
   * the label with any direct `SelectionItem.SubSection` children. `CheckboxItem` and
   * `RadioItem` pass them here because they partition where the element was created: a
   * server-authored SubSection reaches the client as a lazy reference, which the
   * `child.type` filter below cannot recognise.
   */
  subSections?: ReactNode;
  /**
   * Lets a click on a SubSection's passive parts toggle the control: its text, the band
   * around it and the side padding beside it. A click inside a link, button, form field,
   * label or other focusable element in the SubSection stays that element's, and a click
   * that ends a text selection does nothing. The control's accessible name stays the label
   * row, and keyboard and assistive-technology users toggle through the control. Leave it
   * off when the SubSection reveals fields under the control, so a click between those
   * fields does not clear the choice. Default `false`.
   */
  isSubSectionSelectable?: boolean;
  /**
   * Direct children are partitioned: `SelectionItem.SubSection` nodes render outside
   * the label so interactive content does not toggle the control. Everything else
   * renders in the label row. Wrapping a SubSection in a Fragment, another component,
   * or an HOC hides it from `child.type === SelectionItem.SubSection` and it stays
   * inside the label. Server-authored trees should pass SubSections through
   * `subSections`; see that prop.
   */
  children?: ReactNode;
};

/**
 * Shared card-row shell that CheckboxItem and RadioItem plug a control into. Client
 * component, because it reads Field.Item context. The control and sub-section columns
 * share one parent grid, so the spacer tracks the control slot without measuring it.
 * The shell's side padding is the one horizontal inset, so a `px-*` in `className` sets it.
 * The label is `display: contents`, so its cells are shell grid items and its `::before`
 * is an absolute child of the shell grid. With automatic columns, that pseudo-element
 * spans the shell's padding box, so a click anywhere across the label row toggles the
 * control at any inset. While a SubSection shows, it covers the label row only and the
 * sub-section band keeps its own clicks; while every SubSection is `mode="hidden"`, it
 * covers the whole row, bottom inset included. With `isSubSectionSelectable` it always
 * covers the whole row, and a click on the band's passive parts toggles the control.
 * Nothing clips, so a focus ring at a zero inset paints whole.
 *
 * Vertical and default shells, in either group shape or outside any group, collapse
 * borders with `not-first:border-t-0`. A checked shell paints its border in the theme's
 * `--selection-checked-border`: `--primary` in internal themes, the resting `--border` in
 * external ones, whose radio card shows the selection through its control alone. A checked
 * non-first shell repaints its top border in that colour by pulling itself up one pixel
 * (`has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px`)
 * instead of a z-index lift; `className` margin overrides can break that. Horizontal
 * item groups render individually rounded full-border cards with no vertical border
 * collapse and no checked negative margin. Checked selectors are scoped to the
 * private control slot so a checked descendant in SubSection cannot repaint the shell.
 *
 * It publishes `--inner-corner`, its corner less its border and padding, for parts that round with
 * `rounded-inner`.
 */
export function SelectionItemShell({
  dataSlot,
  control,
  controlPosition = "start",
  isDisabled,
  className,
  subSections: passedSubSections,
  isSubSectionSelectable = false,
  children,
  ...props
}: SelectionItemShellProps): ReactElement {
  const groupLayout = useContext(SelectionItemGroupContext);
  const inItemGroup = groupLayout !== false && groupLayout.list;
  const connectedStack = groupLayout === false || groupLayout.orientation !== "horizontal";
  const childArray = Children.toArray(children);
  const directSubSections = childArray.filter(
    (child) => isValidElement(child) && child.type === SelectionItemSubSection
  );
  const rowChildren = childArray.filter(
    (child) => !(isValidElement(child) && child.type === SelectionItemSubSection)
  );
  const hasSubSection = Children.toArray(passedSubSections).length > 0 || directSubSections.length > 0;
  const controlAtEnd = controlPosition === "end";

  const rowCellClass = cn("self-start pt-3.5", hasSubSection ? null : "pb-3.5");
  // The slot's content box is one title line tall, `--control-text-row` at the title's
  // `leading-snug`, and centres the control in it, so the control sits on the title's first
  // line at either density. That replaces Item.Media's nudge for a row with a description,
  // which was tuned to a 14px title.
  const controlSlot = (
    <ItemMedia
      variant="icon"
      data-slot="selection-item-control"
      className={cn(
        rowCellClass,
        "box-content h-[calc(var(--control-text-row)*var(--leading-snug))] group-has-data-[slot=item-description]/item:translate-y-0"
      )}>
      {control}
    </ItemMedia>
  );
  const rowCluster = (
    <div className={cn("flex min-w-0 items-start gap-2.5", rowCellClass)}>{rowChildren}</div>
  );
  const spacer = <span aria-hidden />;
  // `mergeProps` runs the consumer's `onClick` first; `preventBaseUIHandler()` there skips this.
  const selectFromSubSection = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) {
      return;
    }
    // React bubbles clicks from portals and from rows nested in a SubSection; only a click
    // in this row's own band toggles it.
    const band = event.target.closest("[data-slot=selection-item-sub-sections]");
    if (band?.parentElement !== event.currentTarget) {
      return;
    }
    const ownClick = event.target.closest(subSectionOwnClickSelector);
    if (ownClick && band.contains(ownClick)) {
      return;
    }
    // A selection elsewhere outlives a click in a `select-none` card list, so only one that
    // reaches into the band counts as the click that ended it.
    const selection = window.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (range && !range.collapsed && range.intersectsNode(band)) {
      return;
    }
    // The label's control is the hidden input. Clicking it toggles without dispatching another
    // click through the row, so ancestors and `onClick` see this one click only. Focusing it
    // moves focus to the visible control, as a click on the label row does, so the keyboard
    // carries on from the chosen row.
    const label = event.currentTarget.querySelector(":scope > label");
    const control = label instanceof HTMLLabelElement ? label.control : null;
    control?.click();
    control?.focus({ preventScroll: true });
  };
  // Separate child positions give each source its own key space; one merged array
  // would repeat the `.0` keys that the two `Children.toArray` calls assign independently.
  // The band ignores pointers until a footer shows, so the cluster takes them back: content in
  // a SubSection that `subSections` passes inside a wrapper stays clickable. A hidden footer
  // turns them off for itself.
  const subCluster = (
    <div className="pointer-events-auto min-w-0">
      {passedSubSections}
      {directSubSections}
    </div>
  );

  return (
    <FieldItem
      {...(inItemGroup ? { role: "listitem" as const } : null)}
      {...props}
      {...(isSubSectionSelectable
        ? mergeProps<"div">({ onClick: selectFromSubSection }, { onClick: props.onClick })
        : null)}
      data-slot={dataSlot}
      data-selection-item=""
      className={cn(
        outlineItemClass,
        selectionItemShellClass,
        "relative isolate box-border grid items-stretch gap-0 gap-x-2.5 bg-card py-0 text-(length:--control-text-row) leading-(--control-leading-row) transition-colors has-[[data-slot=selection-item-control]_[data-checked]]:border-selection-checked-border has-[[data-slot=selection-item-control]_[data-checked]]:bg-muted",
        controlAtEnd ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]",
        connectedStack
          ? "rounded-none not-first:border-t-0 first:rounded-t-lg last:rounded-b-lg has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px has-[[data-slot=selection-item-control]_[data-checked]]:not-first:border-t"
          : "rounded-lg",
        isDisabled ? cn("cursor-not-allowed bg-muted", disabledHatch) : null,
        className
      )}>
      <FieldPrimitive.Label className={cn(labelClass, isSubSectionSelectable ? null : labelRowTargetClass)}>
        {controlAtEnd ? (
          <>
            {rowCluster}
            {controlSlot}
          </>
        ) : (
          <>
            {controlSlot}
            {rowCluster}
          </>
        )}
      </FieldPrimitive.Label>
      {hasSubSection ? (
        <div
          data-slot="selection-item-sub-sections"
          className={cn(subSectionBandClass, isSubSectionSelectable ? selectableBandClass : null)}>
          {controlAtEnd ? (
            <>
              {subCluster}
              {spacer}
            </>
          ) : (
            <>
              {spacer}
              {subCluster}
            </>
          )}
        </div>
      ) : null}
    </FieldItem>
  );
}

SelectionItemShell.displayName = "SelectionItem.Shell";
SelectionItemTitle.displayName = "SelectionItem.Title";
SelectionItemActions.displayName = "SelectionItem.Actions";
SelectionItemSubSection.displayName = "SelectionItem.SubSection";
