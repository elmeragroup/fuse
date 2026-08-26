"use client";

import { Children, isValidElement } from "react";
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "../../styles/cn";
import { disabledHatch } from "../../styles/utils";
import { Field } from "../field/field";
import { Item } from "../item/item";
import { itemVariants } from "../item/item-variants";

function SelectionItemTitle({ className, ...props }: ComponentProps<typeof Item.Title>): ReactElement {
  return <Item.Title className={cn("font-normal", className)} {...props} />;
}

function SelectionItemActions({ className, ...props }: ComponentProps<typeof Item.Actions>): ReactElement {
  return <Item.Actions className={cn("-translate-y-0.5 items-start", className)} {...props} />;
}

/**
 * Footer band rendered **outside** the row label. Direct `SelectionItem.SubSection`
 * children are partitioned by identity (`child.type === SelectionItem.SubSection`); a
 * Fragment, wrapper, or HOC hides the part from that filter and it stays inside the
 * label, so clicks would toggle the control.
 */
function SelectionItemSubSection({
  children,
  className,
  mode = "default",
  ...props
}: ComponentProps<typeof Item.Footer>): ReactElement | null {
  if (Children.toArray(children).length === 0) {
    return null;
  }
  return (
    <Item.Footer mode={mode} className={className} {...props}>
      {children}
    </Item.Footer>
  );
}

type SelectionItemShellProps = Omit<ComponentProps<typeof Field.Item>, "className" | "children"> & {
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
 * Shared card-row shell that CheckboxItem and RadioItem plug a control into
 * (selection-item.md §2/§7). Client — Field.Item context (performance.md §RSC
 * classification). Control and sub-section columns share one parent grid so the
 * spacer tracks the control slot without measuring it.
 *
 * Stacked shells collapse borders with `not-first:border-t-0`. A checked non-first
 * shell repaints its top border in `primary` by pulling itself up one pixel
 * (`has-data-checked:not-first:-mt-px`) instead of a z-index lift; `className`
 * margin overrides can break that.
 */
function SelectionItemShell({
  dataSlot,
  control,
  controlPosition = "start",
  isDisabled,
  className,
  children,
  ...props
}: SelectionItemShellProps): ReactElement {
  const childArray = Children.toArray(children);
  const subSections = childArray.filter(
    (child) => isValidElement(child) && child.type === SelectionItemSubSection
  );
  const rowChildren = childArray.filter(
    (child) => !(isValidElement(child) && child.type === SelectionItemSubSection)
  );
  const hasSubSection = subSections.length > 0;
  const controlAtEnd = controlPosition === "end";

  const controlSlot = <Item.Media variant="icon">{control}</Item.Media>;
  const rowCluster = <div className="flex min-w-0 items-start gap-2.5">{rowChildren}</div>;
  const spacer = <span aria-hidden />;
  const subCluster = <div className="min-w-0">{subSections}</div>;

  return (
    <Field.Item
      {...props}
      data-slot={dataSlot}
      className={cn(
        itemVariants({ variant: "outline" }),
        "grid items-stretch gap-0 gap-x-2.5 bg-background px-4 py-0 transition-colors has-data-checked:border-primary has-data-checked:bg-muted",
        controlAtEnd ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[auto_minmax(0,1fr)]",
        "rounded-none not-first:border-t-0 first:rounded-t-lg last:rounded-b-lg",
        "has-data-checked:not-first:-mt-px has-data-checked:not-first:border-t",
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
    </Field.Item>
  );
}

SelectionItemShell.displayName = "SelectionItem.Shell";
SelectionItemTitle.displayName = "SelectionItem.Title";
SelectionItemActions.displayName = "SelectionItem.Actions";
SelectionItemSubSection.displayName = "SelectionItem.SubSection";

/**
 * Shared selectable card row. `CheckboxItem` / `RadioItem` alias these part objects in
 * later tickets so `child.type` partitioning keeps working across spellings.
 */
export const SelectionItem = {
  Shell: SelectionItemShell,
  Title: SelectionItemTitle,
  Description: Item.Description,
  Content: Item.Content,
  Actions: SelectionItemActions,
  SubSection: SelectionItemSubSection,
};
