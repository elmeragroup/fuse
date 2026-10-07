"use client";

import { Children, createContext, isValidElement, useContext, useMemo } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "../../styles/cn";
import { disabledHatch } from "../../styles/utils";
import { FieldItem } from "../field/field";
import { ItemGroup } from "../item/item";
import { ITEM_DESCRIPTION_CLASSES } from "../item/item-description-classes";
import { ItemActions, ItemFooter, ItemMedia, ItemTitle } from "../item/item-markup";
import { itemVariants } from "../item/item-variants";
import { selectionGroupOrientationVariants } from "./selection-item-variants";
import type { SelectionItemGroupOrientation } from "./selection-item-variants";

/** Resolved once at module scope — the shell always borrows the `outline` arm. */
const outlineItemClass = itemVariants({ variant: "outline" });

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

export function SelectionItemTitle({ className, ...props }: ComponentProps<typeof ItemTitle>): ReactElement {
  return <ItemTitle className={cn("font-normal", className)} {...props} />;
}

/**
 * The option's supporting text. It sits inside the row's label, so it is part of the
 * control's accessible name and shows every line: unlike `Item.Description` it carries no
 * two-line clamp, which would cut what a screen reader still reads out. It keeps the
 * `item-description` slot, so the control at the row's start stays aligned with the title.
 */
export function SelectionItemDescription({ className, ...props }: ComponentProps<"p">): ReactElement {
  return <p data-slot="item-description" className={cn(ITEM_DESCRIPTION_CLASSES, className)} {...props} />;
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
 * is an absolute child of the shell grid. Placed in the label's row with automatic
 * columns, that pseudo-element spans the shell's padding box, so a click anywhere across
 * the label row toggles the control at any inset. Nothing clips, so a focus ring at a
 * zero inset paints whole.
 *
 * Vertical and default shells, in either group shape or outside any group, collapse
 * borders with `not-first:border-t-0`. A checked non-first shell then repaints its top border in
 * `primary` by pulling itself up one pixel
 * (`has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px`)
 * instead of a z-index lift; `className` margin overrides can break that. Horizontal
 * item groups render individually rounded full-border cards with no vertical border
 * collapse and no checked negative margin. Checked selectors are scoped to the
 * private control slot so a checked descendant in SubSection cannot repaint the shell.
 */
export function SelectionItemShell({
  dataSlot,
  control,
  controlPosition = "start",
  isDisabled,
  className,
  subSections: passedSubSections,
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
  const controlSlot = (
    <ItemMedia variant="icon" data-slot="selection-item-control" className={rowCellClass}>
      {control}
    </ItemMedia>
  );
  const rowCluster = (
    <div className={cn("flex min-w-0 items-start gap-2.5", rowCellClass)}>{rowChildren}</div>
  );
  const spacer = <span aria-hidden />;
  // Separate child positions give each source its own key space; one merged array
  // would repeat the `.0` keys that the two `Children.toArray` calls assign independently.
  const subCluster = (
    <div className="min-w-0">
      {passedSubSections}
      {directSubSections}
    </div>
  );

  return (
    <FieldItem
      {...(inItemGroup ? { role: "listitem" as const } : null)}
      {...props}
      data-slot={dataSlot}
      data-selection-item=""
      className={cn(
        outlineItemClass,
        "relative isolate box-border grid items-stretch gap-0 gap-x-2.5 bg-card px-4 py-0 transition-colors has-[[data-slot=selection-item-control]_[data-checked]]:border-primary has-[[data-slot=selection-item-control]_[data-checked]]:bg-muted",
        controlAtEnd ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]",
        connectedStack
          ? "rounded-none not-first:border-t-0 first:rounded-t-lg last:rounded-b-lg has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px has-[[data-slot=selection-item-control]_[data-checked]]:not-first:border-t"
          : "rounded-lg",
        isDisabled ? cn("cursor-not-allowed bg-muted", disabledHatch) : null,
        className
      )}>
      <FieldPrimitive.Label className="contents cursor-pointer before:absolute before:inset-0 before:-z-1 before:row-[1/2] has-disabled:cursor-not-allowed">
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
        <div className="col-span-full grid grid-cols-subgrid pb-3.5">
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
SelectionItemDescription.displayName = "SelectionItem.Description";
SelectionItemActions.displayName = "SelectionItem.Actions";
SelectionItemSubSection.displayName = "SelectionItem.SubSection";
