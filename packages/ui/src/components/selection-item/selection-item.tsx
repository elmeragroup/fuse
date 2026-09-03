"use client";

import { Children, createContext, isValidElement, useContext } from "react";
import type { ComponentProps, ComponentType, ReactElement, ReactNode } from "react";

import { Field as FieldPrimitive } from "@base-ui/react/field";

import { cn } from "../../styles/cn";
import { disabledHatch } from "../../styles/utils";
import { Field } from "../field/field";
import { Item } from "../item/item";
import { itemVariants } from "../item/item-variants";

export type SelectionItemGroupOrientation = "vertical" | "horizontal";
type SelectionItemGroupContextValue = false | SelectionItemGroupOrientation;

const SelectionItemGroupContext = createContext<SelectionItemGroupContextValue>(false);

/**
 * The one orientation map for the selection-group family (checkbox.md §8.10,
 * radio-group.md §8.11): `group` lays out the group primitive itself, `list` the private
 * stacked-card list inside it. CheckboxGroup and RadioGroup read `group` through
 * {@link SelectionGroupFrame}'s callers, `SelectionItemGroup` reads `list`, and the three
 * copies of these two strings that used to sit in `checkbox.tsx`, `radio-group.tsx` and
 * this file are gone (spec 08 finding S18).
 *
 * The option-stack `gap-2` is layout, not a control rung (radio-group.md §4), which is why
 * it is a plain literal here and not a `--control-gap-*` read.
 */
export const selectionGroupOrientationClass = {
  group: { vertical: "flex flex-col gap-2", horizontal: "flex flex-wrap gap-4" },
  list: { vertical: "gap-0", horizontal: "flex-row flex-wrap gap-4" },
} as const satisfies Record<"group" | "list", Record<SelectionItemGroupOrientation, string>>;

/** The legend row's own layout, the selection-group twin of `FieldFrame`'s label row. */
const selectionGroupLegendRowClass = "flex items-center justify-between";

type SelectionGroupFrameBaseProps = {
  /** Fieldset legend, rendered as `Field.Legend variant="label"`. */
  label?: string;
  /** Supporting copy, rendered as `Field.Description` when truthy. */
  description?: string;
  /** Error copy, rendered as `Field.Error`, which self-suppresses on falsy children. */
  errorMessage?: ReactNode;
  /** Forwarded to `Field.Root`. CheckboxGroup threads its `name` here (checkbox.md §8.6). */
  name?: string;
  /** Forwarded to `Field.Root`. */
  isInvalid?: boolean;
  /** Forwarded to `Field.Root`. */
  isDisabled?: boolean;
  /** The group primitive this frame legends — a direct child of `Field.Set`. */
  children: ReactNode;
};

/**
 * A composite either has a status face beside its legend or it does not, and that is a
 * property of the composite rather than of one render: RadioGroup always renders the
 * legend inside a status row (so an unlabeled pending group emits an empty legend, which
 * is radio-group.md §8.2's gate `label || isPending`), while CheckboxGroup renders a bare
 * legend and has no status face at all. The union makes the second case unable to pass a
 * `status` node that the frame would silently drop.
 */
type SelectionGroupFrameProps = SelectionGroupFrameBaseProps &
  (
    | {
        /** Puts the legend in a row with {@link SelectionGroupFrameProps.status}. */
        groupsLegendWithStatus: true;
        /** Component-owned status face at the row's end — RadioGroup's pending spinner. */
        status?: ReactNode;
      }
    | { groupsLegendWithStatus?: false; status?: never }
  );

/**
 * Package-private fieldset skeleton for the labeled selection groups (selection-item.md
 * §8.8; spec 08 finding S18). CheckboxGroup and RadioGroup had rebuilt the same
 * `Field.Root` → `Field.Set` → legend → description → primitive → error shape, and the
 * copies had drifted: both guarded `errorMessage ?` although `Field.Error` already returns
 * null for falsy children (field.tsx), and only one of them owned a status row.
 *
 * It renders **one** `Field.Root`, so the nested-root name-shadowing trap of field.md §7
 * is neither reintroduced nor widened: a member control's name still comes from its own
 * `Field.Item`/label row, and the group's name from the legend.
 */
export function SelectionGroupFrame({
  label,
  description,
  errorMessage,
  name,
  isInvalid,
  isDisabled,
  groupsLegendWithStatus = false,
  status,
  children,
}: SelectionGroupFrameProps): ReactElement {
  const legend = <Field.Legend variant="label">{label}</Field.Legend>;
  return (
    <Field.Root name={name} invalid={isInvalid} disabled={isDisabled}>
      <Field.Set>
        {groupsLegendWithStatus ? (
          label || status != null ? (
            <div className={selectionGroupLegendRowClass}>
              {legend}
              {status}
            </div>
          ) : null
        ) : label ? (
          legend
        ) : null}
        {description ? <Field.Description>{description}</Field.Description> : null}
        {children}
        <Field.Error>{errorMessage}</Field.Error>
      </Field.Set>
    </Field.Root>
  );
}

SelectionGroupFrame.displayName = "SelectionGroupFrame";

/** The props {@link renderSelectionItemCardGroup} reads off the group it wraps. */
type SelectionItemCardGroupProps = {
  orientation?: SelectionItemGroupOrientation;
  children?: ReactNode;
};

/**
 * The one stacked-card group body, parameterized by the labeled group that hosts it
 * (spec 08 user story 18): `CheckboxItemGroup` passes `CheckboxGroup`, `RadioItemGroup`
 * passes `RadioGroup`, and each stays a component of its own so its public signature and
 * prop docs are unchanged. `orientation` is forwarded twice on purpose — to the outer
 * group primitive and to the private item list — which is the whole reason the two
 * wrappers existed (checkbox.md §8.10, radio-group.md §8.11).
 */
export function renderSelectionItemCardGroup<P extends SelectionItemCardGroupProps>(
  Group: ComponentType<P>,
  props: P
): ReactElement {
  const orientation = props.orientation ?? "vertical";
  return (
    <Group {...props} orientation={orientation}>
      <SelectionItemGroup orientation={orientation}>{props.children}</SelectionItemGroup>
    </Group>
  );
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
  return (
    <SelectionItemGroupContext.Provider value={orientation}>
      <Item.Group className={cn("select-none", selectionGroupOrientationClass.list[orientation])}>
        {children}
      </Item.Group>
    </SelectionItemGroupContext.Provider>
  );
}

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
 * Vertical, default, and shells outside the private group collapse borders with
 * `not-first:border-t-0`. A checked non-first shell then repaints its top border in
 * `primary` by pulling itself up one pixel
 * (`has-[[data-slot=selection-item-control]_[data-checked]]:not-first:-mt-px`)
 * instead of a z-index lift; `className` margin overrides can break that. Horizontal
 * item groups render individually rounded full-border cards with no vertical border
 * collapse and no checked negative margin. Checked selectors are scoped to the
 * private control slot so a checked descendant in SubSection cannot repaint the shell.
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
  const groupLayout = useContext(SelectionItemGroupContext);
  const inItemGroup = groupLayout !== false;
  const connectedStack = groupLayout !== "horizontal";
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
    <Item.Media variant="icon" data-slot="selection-item-control">
      {control}
    </Item.Media>
  );
  const rowCluster = <div className="flex min-w-0 items-start gap-2.5">{rowChildren}</div>;
  const spacer = <span aria-hidden />;
  const subCluster = <div className="min-w-0">{subSections}</div>;

  return (
    <Field.Item
      {...(inItemGroup ? { role: "listitem" as const } : null)}
      {...props}
      data-slot={dataSlot}
      className={cn(
        itemVariants({ variant: "outline" }),
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
