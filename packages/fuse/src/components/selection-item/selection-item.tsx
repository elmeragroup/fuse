"use client";

import { Children, createContext, isValidElement, useContext, useMemo } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "../../styles/cn";
import { disabledHatch } from "../../styles/utils";
import { FieldItem } from "../field/field";
import { ItemGroup } from "../item/item";
import { ItemActions, ItemFooter, ItemMedia, ItemTitle } from "../item/item-markup";
import { itemVariants } from "../item/item-variants";
import { selectionGroupOrientationVariants } from "./selection-item-variants";
import type { SelectionItemGroupOrientation } from "./selection-item-variants";

/** Resolved once at module scope — the shell always borrows the `outline` arm. */
const outlineItemClass = itemVariants({ variant: "outline" });

export type { SelectionItemGroupOrientation };

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
  /** Extra classes, merged last through `cn`. */
  className?: string;
  /**
   * Direct children are partitioned: `SelectionItem.SubSection` nodes render outside
   * the label so interactive content does not toggle the control. Everything else
   * renders in the label row. Wrapping a SubSection in a Fragment, another component,
   * or an HOC hides it from `child.type === SelectionItem.SubSection` and it stays
   * inside the label.
   */
  children?: ReactNode;
};

/**
 * Shared card-row shell that CheckboxItem and RadioItem plug a control into. Client
 * component, because it reads Field.Item context. The control and sub-section columns
 * share one parent grid, so the spacer tracks the control slot without measuring it.
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
  children,
  ...props
}: SelectionItemShellProps): ReactElement {
  const groupLayout = useContext(SelectionItemGroupContext);
  const inItemGroup = groupLayout !== false && groupLayout.list;
  const connectedStack = groupLayout === false || groupLayout.orientation !== "horizontal";
  const childArray = Children.toArray(children);
  const subSections = childArray.filter(
    (child) => isValidElement(child) && child.type === SelectionItemSubSection
  );
  const rowChildren = childArray.filter(
    (child) => !(isValidElement(child) && child.type === SelectionItemSubSection)
  );
  const hasSubSection = subSections.length > 0;
  const controlAtEnd = controlPosition === "end";

  const controlSlot = (
    <ItemMedia variant="icon" data-slot="selection-item-control">
      {control}
    </ItemMedia>
  );
  const rowCluster = <div className="flex min-w-0 items-start gap-2.5">{rowChildren}</div>;
  const spacer = <span aria-hidden />;
  const subCluster = <div className="min-w-0">{subSections}</div>;

  return (
    <FieldItem
      {...(inItemGroup ? { role: "listitem" as const } : null)}
      {...props}
      data-slot={dataSlot}
      data-selection-item=""
      className={cn(
        outlineItemClass,
        "grid items-stretch gap-0 gap-x-2.5 bg-background px-4 py-0 transition-colors has-[[data-slot=selection-item-control]_[data-checked]]:border-primary has-[[data-slot=selection-item-control]_[data-checked]]:bg-muted",
        controlAtEnd ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]",
        connectedStack
          ? "rounded-none not-first:border-t-0 first:rounded-t-lg last:rounded-b-lg has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px has-[[data-slot=selection-item-control]_[data-checked]]:not-first:border-t"
          : "rounded-lg",
        isDisabled ? cn("cursor-not-allowed bg-muted", disabledHatch) : null,
        className
      )}>
      <FieldPrimitive.Label
        className={cn(
          "col-span-full grid cursor-pointer grid-cols-subgrid items-start pt-3.5 has-disabled:cursor-not-allowed",
          hasSubSection ? null : "pb-3.5"
        )}>
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
SelectionItemActions.displayName = "SelectionItem.Actions";
SelectionItemSubSection.displayName = "SelectionItem.SubSection";
