"use client";

import { Children, createContext, isValidElement, useContext, useMemo } from "react";
import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";

import { cn } from "../../styles/cn";
import { selectionItemShellClass } from "../../styles/inner-corner/item";
import { labelTypeClass } from "../../styles/label-type";
import { FieldItem } from "../field/field";
import { ItemGroup } from "../item/item";
import { ItemActions, ItemFooter, ItemMedia, ItemTitle } from "../item/item-markup";
import { itemVariants } from "../item/item-variants";
import { selectionGroupOrientationVariants } from "./selection-item-variants";
import type { SelectionItemGroupOrientation } from "./selection-item-variants";

/** Resolved once at module scope — the shell always borrows the `outline` arm. */
const outlineItemClass = itemVariants({ variant: "outline" });

// A connected stack's rows share one line per join: every row but the first drops its top border,
// and a checked one pulls itself up one pixel to paint that line itself. The dividers key on an
// adjacent selection row, not on first or last child, so a lone shell beside a Field.Description
// or Field.Error draws no line. A row with a row after it takes the divider on its bottom edge,
// which outranks the shell's resting edge (0,2,0 over 0,1,0) and yields to a checked row's
// whole-box edge (0,3,0). A checked row takes the checked divider on each edge it shares with a
// row, which outranks that box (0,4,0). Every other edge keeps the row's own.
const connectedStackClass = cn(
  "rounded-none not-first:border-t-0 first:rounded-t-lg last:rounded-b-lg has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px has-[[data-slot=selection-item-control]_[data-checked]]:not-first:border-t",
  "[&:has(+[data-selection-item])]:border-b-selection-divider has-[[data-slot=selection-item-control]_[data-checked]]:[&:has(+[data-selection-item])]:border-b-selection-checked-divider has-[[data-slot=selection-item-control]_[data-checked]]:[[data-selection-item]+&]:border-t-selection-checked-divider"
);

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

// The row's first line, which the control and Actions centre on: one line of the label text
// `--label-text` at `--label-leading` for a plain-text row, which inherits the shell's label type,
// or one line of SelectionItem.Title, `--label-text` at `leading-snug`, once the label row holds
// one. The shell owns it as `--selection-first-line`, so both parts read one value. The title
// test looks through the label only, so a row nested in a SubSection does not count.
const firstLineClass = cn(
  "[--selection-first-line:var(--label-leading)] has-[>label_[data-slot=selection-item-title]]:[--selection-first-line:calc(var(--label-text)*var(--leading-snug))]"
);

// The disabled row. A shell is disabled when its own `isDisabled` or a disabled group's Field
// root marks it `data-disabled`, or when its own control is disabled, a control in this row's
// label rather than one nested in a SubSection. The `:is()` takes the specificity of its
// `:has()` arm whichever arm matches, which outweighs the checked row's `bg-muted`, so a
// disabled row fills with `--selection-disabled-background`, checked or not. The 45° hatch
// alternates 8px transparent bands with 8px of `--selection-disabled-hatch`: a black alpha in
// internal themes, transparent in external ones. Tailwind reads class names from the source
// text, so each selector is written out in full.
const disabledShellClass = cn(
  "[&:is([data-disabled],:has(>label>[data-slot=selection-item-control]_[data-disabled]))]:cursor-not-allowed",
  "[&:is([data-disabled],:has(>label>[data-slot=selection-item-control]_[data-disabled]))]:bg-selection-disabled-background",
  "[&:is([data-disabled],:has(>label>[data-slot=selection-item-control]_[data-disabled]))]:bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,--theme(--color-selection-disabled-hatch)_8px,--theme(--color-selection-disabled-hatch)_16px)]"
);
// A disabled row's label content (title, description, actions) takes the 50% of the shared
// disabled look, as a plain `Radio` row's label does. The control dims itself, so the label row
// cluster dims beside it rather than the whole label, and a SubSection, which may hold enabled
// content, keeps its colours.
const disabledLabelContentClass = cn(
  "[[data-selection-item]:is([data-disabled],:has(>label>[data-slot=selection-item-control]_[data-disabled]))>label>&]:opacity-50"
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
   * `flex-col gap-0`. Horizontal is `flex-row flex-wrap`, gapped by `--surface-gap-lg`.
   */
  orientation?: SelectionItemGroupOrientation;
};

/**
 * Private stacked-card list wrapper. `Item.Group` still emits `role="list"`;
 * `SelectionItem.Shell` reads this context and defaults to `role="listitem"`.
 * Vertical remains a connected `flex-col gap-0` stack; horizontal is the actual
 * item list `flex-row flex-wrap`, gapped by `--surface-gap-lg`, with individually rounded shells.
 * Not part of the public `SelectionItem` namespace or entry.
 */
export function SelectionItemGroup({
  children,
  orientation = "vertical",
}: SelectionItemGroupProps): ReactElement {
  const value = useMemo(() => ({ orientation, list: true }), [orientation]);
  return (
    <SelectionItemGroupContext.Provider value={value}>
      <ItemGroup
        // The layout axis, as Card writes it: a vertical stack of selection shells is connected.
        data-direction={orientation}
        className={cn("select-none", selectionGroupOrientationVariants({ orientation }).list())}>
        {children}
      </ItemGroup>
    </SelectionItemGroupContext.Provider>
  );
}

/**
 * A selection row's title, `CheckboxItem.Title` and `RadioItem.Title`: the option's name, in its
 * own `selection-item-title` slot because it is label text. It takes the label text size,
 * `--label-text`, in place of `Item.Title`'s fixed `text-sm`. The size carries `leading-snug` as
 * its `/snug` modifier: a separate `leading-snug` before it would fall to tailwind-merge, which
 * drops a line height that comes before a font size, and the formatter sorts the classes inside a
 * string.
 *
 * Its weight comes from the theme's `--selection-title-weight`: 400 in internal themes and 500
 * in external ones, which matches the group legend and `CheckboxCard` titles. Without
 * `themes.css` it is 400 unless the host sets the role. A `className` weight, such as
 * `font-medium`, replaces it.
 */
export function SelectionItemTitle({ className, ...props }: ComponentProps<typeof ItemTitle>): ReactElement {
  return (
    <ItemTitle
      data-slot="selection-item-title"
      className={cn(
        "text-(length:--label-text)/snug font-[number:var(--selection-title-weight,400)]",
        className
      )}
      {...props}
    />
  );
}

/**
 * A selection row's trailing content, such as a price or a badge: `CheckboxItem.Actions` and
 * `RadioItem.Actions`. Its box is at least one first line of the row tall, the line the control
 * centres on, and its text takes that line height, so one line of text or a badge up to a line
 * tall centres on the title's first line. Wrapped text keeps its first line there and grows the
 * row, and content taller than a line tops flush with the title.
 */
export function SelectionItemActions({
  className,
  ...props
}: ComponentProps<typeof ItemActions>): ReactElement {
  return (
    <ItemActions
      className={cn("min-h-(--selection-first-line) leading-(--selection-first-line)", className)}
      {...props}
    />
  );
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
   * Shows the disabled row: the `not-allowed` cursor, the theme's
   * `--selection-disabled-background` fill under a 45° hatch striped in
   * `--selection-disabled-hatch`, and the label row's content at 50%. Internal themes fill with
   * `--muted` and black stripes at 2% alpha; external themes keep the card fill with no
   * stripes. The control dims itself, and a SubSection keeps its colours. A row whose control
   * is disabled, or whose group is, shows the same look without it. Does not disable the
   * control — the control or group owns that.
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
 * The shell's 1px edge is the theme's `--selection-border`, not Item's outline `--border`:
 * `--border` in internal themes, a zero-alpha colour in external ones, which keeps the border's
 * geometry but draws no line. A checked shell paints its edge in the theme's
 * `--selection-checked-border`: `--primary` in internal themes, the resting `--selection-border`
 * in external ones, whose radio card shows the selection through its control alone.
 *
 * Vertical and default shells, in either group shape or outside any group, collapse borders with
 * `not-first:border-t-0`, so one line divides two rows. The bottom edge of a row with another
 * row after it is the theme's `--selection-divider`, and a checked row's edges shared with another
 * row are its `--selection-checked-divider`. Internal themes alias them to the row's own edges, so
 * a checked row stays boxed in `--primary`. External themes draw both in `--border`: stacked rows
 * keep a grey separator, checked or not, while the sides, the stack's outer top and bottom and a
 * lone row beside other Field parts stay transparent. A checked non-first shell repaints its top border by pulling itself up one
 * pixel (`has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px`) instead of a
 * z-index lift; `className` margin overrides can break that. Horizontal item groups render
 * individually rounded full-border cards with no vertical border collapse, no divider and no
 * checked negative margin. Checked selectors are scoped to the private control slot so a checked
 * descendant in SubSection cannot repaint the shell.
 *
 * A disabled shell, through `isDisabled`, a disabled group or its own disabled control, fills
 * with the theme's `--selection-disabled-background` under a hatch of
 * `--selection-disabled-hatch`, which outweighs the checked fill and leaves the checked border,
 * joins and pull-up alone. The label row's content dims at 50% beside the control's own 50%,
 * and a SubSection keeps its colours.
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
  // The slot's content box is one first line of the row tall and centres the control in it, so
  // the control sits on the first line at either density. Its height replaces icon media's
  // Item.Title line, which is 14px type, for SelectionItem.Description and the public
  // Item.Description alike.
  const controlSlot = (
    <ItemMedia
      variant="icon"
      data-slot="selection-item-control"
      className={cn(rowCellClass, "box-content h-(--selection-first-line)")}>
      {control}
    </ItemMedia>
  );
  const rowCluster = (
    <div className={cn("flex min-w-0 items-start gap-2.5", rowCellClass, disabledLabelContentClass)}>
      {rowChildren}
    </div>
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
      {...(isDisabled ? { "data-disabled": "" } : null)}
      data-slot={dataSlot}
      data-selection-item=""
      className={cn(
        outlineItemClass,
        selectionItemShellClass,
        labelTypeClass,
        firstLineClass,
        "relative isolate box-border grid items-stretch gap-0 gap-x-2.5 border-selection-border bg-card py-0 transition-colors has-[[data-slot=selection-item-control]_[data-checked]]:border-selection-checked-border has-[[data-slot=selection-item-control]_[data-checked]]:bg-muted",
        controlAtEnd ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]",
        connectedStack ? connectedStackClass : "rounded-lg",
        disabledShellClass,
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
