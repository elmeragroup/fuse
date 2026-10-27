"use client";

// The bar: one Base UI Toolbar, so the whole bar is one Tab stop with arrow-key roving. Each chip
// is a Toolbar.Group of Toolbar.Buttons. State and wiring sit on the Base UI part, and the Fuse
// Button is only its `render` element.

import { use, useCallback, useMemo } from "react";
import type {
  ComponentProps,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  ReactNode,
  Ref,
  RefCallback,
  SyntheticEvent,
} from "react";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";

import { useMergedRefs } from "../../hooks/use-merged-refs";
import { Funnel } from "../../icons/generated/funnel";
import { X } from "../../icons/generated/x";
import { XCircle } from "../../icons/generated/x-circle";
import { definedProps } from "../../internal/defined-props";
import { isHTMLElement, isNode } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Button } from "../button/button";
import { SelectRoot } from "../select/select";
import { assertOverlay, BarContext, ChipContext, useChip, useFilterInternals } from "./data-table-filter";
import type { ChipFilter } from "./data-table-filter";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import { optionsOf } from "./filter-fields";
import { isToggleOn } from "./filter-model";
import type { FilterOperator } from "./filter-model";
import { summarize } from "./filter-summary";
import { OperatorOptions, useOperatorItems } from "./operator-options";
import { scrollStripOnWheel } from "./strip-wheel";

/**
 * Runs the consumer's handler, then the part's bookkeeping whatever the consumer did with the
 * event, since a prevented or stopped press still blurs the editor and may still click.
 */
function always<E>(own: (event: E) => void, theirs: ((event: E) => void) | undefined): (event: E) => void {
  return (event) => {
    theirs?.(event);
    own(event);
  };
}

/**
 * Whether Base UI resolved the pressed control as disabled, its own `disabled` or one inherited from
 * the Bar or the Chip. Toolbar.Button resolves that value from the Toolbar root and group contexts
 * (`toolbar/button/ToolbarButton.tsx:35` in Base UI 1.9), which a part cannot read, and renders it
 * as the `data-disabled` state attribute. Base UI Button, Clear's element outside the bar, renders
 * its own resolved `disabled` the same way. Base UI drops a disabled control's click only in its
 * bubbling handlers, so a capture handler asks this first.
 *
 * @param event - The press event, whose `currentTarget` is the control.
 * @returns `true` when the control is disabled.
 */
function pressIsDisabled(event: SyntheticEvent<HTMLElement>): boolean {
  return event.currentTarget.hasAttribute("data-disabled");
}

/**
 * A ref for one of a chip's segments that also registers it with the Root, so focus can move to
 * it when a neighbour chip goes. The consumer's ref keeps working.
 */
function useSegmentRef(fieldId: string, ref: Ref<HTMLElement> | undefined): RefCallback<HTMLElement> | null {
  const { actions } = useFilterInternals("DataTableFilter.Chip");
  const { registerSegment } = actions;
  const register = useCallback(
    (element: HTMLElement | null) => (element === null ? undefined : registerSegment(fieldId, element)),
    [registerSegment, fieldId]
  );
  return useMergedRefs(ref, register);
}

/** Runs the part's own handler after the consumer's, unless the consumer prevented it. */
function chain<E extends { readonly defaultPrevented: boolean }>(
  own: (event: E) => void,
  theirs: ((event: E) => void) | undefined
): (event: E) => void {
  return (event) => {
    theirs?.(event);
    if (!event.defaultPrevented) {
      own(event);
    }
  };
}

/** The props of `DataTableFilter.Bar`: Base UI Toolbar Root's. */
export type DataTableFilterBarProps = ComponentProps<typeof ToolbarPrimitive.Root>;

/**
 * The filter bar, a toolbar that is one Tab stop with arrow-key roving. Without children it
 * renders the Trigger, the chips and Clear on one line, so its height never grows with the
 * filters. It is named "Filters" unless `aria-label` says otherwise. Below a 36rem container
 * width a container query hides Clear's label behind its icon.
 */
export function DataTableFilterBar({ className, children, ...props }: DataTableFilterBarProps): ReactElement {
  const { state, meta } = useFilterInternals("DataTableFilter.Bar");
  return (
    <BarContext value>
      <ToolbarPrimitive.Root
        data-slot="data-table-filter-bar"
        data-empty={state.filters.length === 0 || undefined}
        aria-label={meta.format("filters")}
        className={mergeClassName(className, slots.bar())}
        {...props}>
        <div data-slot="data-table-filter-bar-row" className={slots.barRow()}>
          {children ?? (
            <>
              <DataTableFilterTrigger />
              <DataTableFilterChips />
              <DataTableFilterClear />
            </>
          )}
        </div>
      </ToolbarPrimitive.Root>
    </BarContext>
  );
}

/** The props of `DataTableFilter.Trigger`. The id belongs to the add menu's handle. */
export type DataTableFilterTriggerProps = Omit<
  ComponentProps<typeof ToolbarPrimitive.Button>,
  "render" | "id"
> & {
  /** The presentation, which replaces the outline Fuse Button. The toolbar and menu wiring stay. */
  render?: ReactElement;
};

/**
 * Opens the add menu, `DataTableFilter.Content`. It sits first in the bar, so a chip added under
 * the open menu never moves it. Without children it draws the icon, named "Filter" unless
 * `aria-label` says otherwise, as a square icon button at every width or in the `render`
 * element. Children replace the icon and render it as a labelled button.
 */
export function DataTableFilterTrigger({
  className,
  children,
  render,
  onClick,
  ref,
  ...props
}: DataTableFilterTriggerProps): ReactElement {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.Trigger");
  const triggerRef = useMergedRefs(ref, actions.registerTrigger);
  const label = props["aria-label"] ?? meta.format("filter");
  const iconOnly = children == null;
  return (
    <ToolbarPrimitive.Button
      ref={triggerRef}
      id={meta.triggerId}
      data-slot="data-table-filter-trigger"
      data-empty={state.filters.length === 0 || undefined}
      // The hidden icon names nothing, so a consumer `render` without its own name takes the label.
      {...(iconOnly ? { "aria-label": label } : null)}
      render={
        <MenuPrimitive.Trigger
          handle={meta.menuHandle}
          render={
            render ??
            // An icon Button requires its own name, and its props win in Base UI's merge.
            (iconOnly ? (
              <Button variant="outline" size="icon-sm" aria-label={label} />
            ) : (
              <Button variant="outline" size="sm" />
            ))
          }
        />
      }
      className={mergeClassName(className, slots.trigger())}
      onClick={chain((_event: MouseEvent<HTMLElement>) => {
        assertOverlay("DataTableFilter.Trigger", meta.hasContent(), "no-content");
      }, onClick)}
      {...definedProps(props)}>
      {iconOnly ? <Funnel aria-hidden /> : children}
    </ToolbarPrimitive.Button>
  );
}

/** The props of `DataTableFilter.Chips`. */
export type DataTableFilterChipsProps = Omit<ComponentProps<"div">, "children"> & {
  /**
   * The template each chip renders, inside its chip context. Plain children are a static
   * template, such as a chip without the Operator. A function receives the chip, to branch on it.
   * Custom segments read the chip with `useDataTableFilterChip()`.
   */
  children?: ReactNode | ((chip: ChipFilter) => ReactNode);
};

/**
 * One chip context per filter, keyed by field id, with no element per chip, in one strip that
 * scrolls sideways at every width. Its ends fade while chips hide past them. A focused segment
 * scrolls into view, since `focus()` leaves a partly visible element where it is, and a vertical
 * mouse wheel scrolls the strip until it reaches an end.
 */
export function DataTableFilterChips({
  className,
  children,
  onFocus,
  ref,
  ...props
}: DataTableFilterChipsProps): ReactElement {
  const { state } = useFilterInternals("DataTableFilter.Chips");
  const stripRef = useMergedRefs(ref, scrollStripOnWheel);
  return (
    <div
      ref={stripRef}
      data-slot="data-table-filter-chips"
      className={cn(slots.chips(), className)}
      onFocus={chain((event: FocusEvent<HTMLDivElement>) => {
        if (isHTMLElement(event.target)) {
          event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
      }, onFocus)}
      {...props}>
      {state.chips.map((chip) => (
        <ChipContext key={chip.id} value={chip}>
          {
            // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the public children contract accepts nodes or a chip function
            typeof children === "function" ? children(chip) : (children ?? <DataTableFilterChip />)
          }
        </ChipContext>
      ))}
    </div>
  );
}

/** The props of `DataTableFilter.Chip`: Base UI Toolbar Group's. */
export type DataTableFilterChipProps = ComponentProps<typeof ToolbarPrimitive.Group>;

/**
 * One filter as a sentence: Subject, Operator, Value and Remove by default. It is a group named
 * "Status filter". Delete or Backspace on any of its segments removes it.
 */
export function DataTableFilterChip({
  className,
  children,
  onKeyDown,
  ref,
  ...props
}: DataTableFilterChipProps): ReactElement {
  const chip = useChip("DataTableFilter.Chip");
  const { actions, meta } = useFilterInternals("DataTableFilter.Chip");
  const { registerChip } = actions;
  const register = useCallback(
    (element: HTMLDivElement | null) => {
      registerChip(chip.id, element);
    },
    [registerChip, chip.id]
  );
  const chipRef = useMergedRefs(ref, register);
  return (
    <ToolbarPrimitive.Group
      ref={chipRef}
      data-slot="data-table-filter-chip"
      data-kind={chip.field.kind}
      data-field={chip.id}
      data-operator={chip.value.operator}
      data-ghost={chip.ghost || undefined}
      aria-label={meta.format("chip", { field: chip.field.label })}
      className={mergeClassName(className, slots.chip())}
      onKeyDown={chain((event: KeyboardEvent<HTMLDivElement>) => {
        // Only keys from the chip's own segments. A portalled Select popup bubbles its keys
        // through the React tree too. A chip the Bar or its own `disabled` disables, and a disabled
        // segment, keep the key, by the `data-disabled` state Base UI resolves for each.
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          isNode(event.target) &&
          event.currentTarget.contains(event.target) &&
          !event.currentTarget.hasAttribute("data-disabled") &&
          !(isHTMLElement(event.target) && event.target.hasAttribute("data-disabled"))
        ) {
          event.preventDefault();
          actions.remove(chip.id);
        }
      }, onKeyDown)}
      {...props}>
      {children ?? (
        <>
          <DataTableFilterSubject />
          <DataTableFilterOperator />
          <DataTableFilterValue />
          <DataTableFilterRemove />
        </>
      )}
    </ToolbarPrimitive.Group>
  );
}

/** The props of `DataTableFilter.Subject`. */
export type DataTableFilterSubjectProps = ComponentProps<"span">;

/** The field's icon and name. Static text, never a Tab or arrow-key stop. */
export function DataTableFilterSubject({
  className,
  children,
  ...props
}: DataTableFilterSubjectProps): ReactElement {
  const chip = useChip("DataTableFilter.Subject");
  return (
    <span data-slot="data-table-filter-subject" className={cn(slots.subject(), className)} {...props}>
      {children ?? (
        <>
          {chip.field.icon === undefined ? null : (
            <span aria-hidden className="contents">
              {chip.field.icon}
            </span>
          )}
          {chip.field.label}
        </>
      )}
    </span>
  );
}

/** The props of `DataTableFilter.Operator`. */
export type DataTableFilterOperatorProps = Omit<ComponentProps<typeof ToolbarPrimitive.Button>, "render"> & {
  /** The trigger's presentation, which replaces the ghost Fuse Button. */
  render?: ReactElement;
};

/**
 * The chip's operator, a Select whose trigger announces "Status operator, is any of". Option
 * fields list only the operators for the current value count, so the operator never disagrees
 * with it. A pick closes it and returns focus to the segment. A ghost chip's operator is disabled.
 * A toggle that is on has no operator. Its name says it.
 */
export function DataTableFilterOperator(props: DataTableFilterOperatorProps): ReactElement | null {
  const chip = useChip("DataTableFilter.Operator");
  const { state } = useFilterInternals("DataTableFilter.Operator");
  if (showsNameOnly(chip, state.editing)) {
    return null;
  }
  return <OperatorSelect {...props} chip={chip} />;
}

/**
 * Whether a chip shows its name and Remove only: a toggle that is on, unless its value popover is
 * open, where it keeps its whole sentence until the popover closes.
 */
function showsNameOnly(chip: ChipFilter, editing: string | null): boolean {
  return isToggleOn(chip.field, chip.value) && editing !== chip.id;
}

function OperatorSelect({
  chip,
  className,
  render,
  ref,
  ...props
}: DataTableFilterOperatorProps & { readonly chip: ChipFilter }): ReactElement {
  const { actions, meta } = useFilterInternals("DataTableFilter.Operator");
  const segmentRef = useSegmentRef(chip.id, ref);
  const applied = chip.value;
  const items = useOperatorItems("DataTableFilter.Operator", chip.field, chip.id, applied, applied.operator);
  return (
    <SelectRoot<FilterOperator>
      items={items}
      value={applied.operator}
      // The table stays scrollable while the operator menu is open.
      modal={false}
      disabled={chip.ghost}
      onValueChange={(operator) => {
        if (operator !== null) {
          actions.setOperator(chip.id, operator);
        }
      }}>
      <ToolbarPrimitive.Button
        ref={segmentRef}
        data-slot="data-table-filter-operator"
        data-operator={applied.operator}
        aria-label={meta.format("operatorLabel", { field: chip.field.label })}
        render={<SelectPrimitive.Trigger render={render ?? <Button variant="ghost" size="sm" />} />}
        className={mergeClassName(className, slots.segment(), slots.operator())}
        {...definedProps(props)}>
        <SelectPrimitive.Value />
      </ToolbarPrimitive.Button>
      <OperatorOptions items={items} align="start" />
    </SelectRoot>
  );
}

/** The props of `DataTableFilter.Value`. The id belongs to the value popover's handle. */
export type DataTableFilterValueProps = Omit<
  ComponentProps<typeof ToolbarPrimitive.Button>,
  "render" | "id"
> & {
  /** The presentation, which replaces the ghost Fuse Button. */
  render?: ReactElement;
};

/**
 * The value summary, which opens the shared value popover at this chip's editor. Its name is the
 * visible summary, and a shortened summary states the whole value as its description. Children
 * replace the summary. A toggle that is on has no value.
 */
export function DataTableFilterValue({
  className,
  children,
  render,
  onClick,
  ref,
  ...props
}: DataTableFilterValueProps): ReactElement | null {
  const chip = useChip("DataTableFilter.Value");
  const { state, actions, meta } = useFilterInternals("DataTableFilter.Value");
  const segmentRef = useSegmentRef(chip.id, ref);
  // One payload object per chip. Base UI measures the popover again whenever the payload's
  // identity changes (`usePopupViewport.tsx`), so a new object per render would remeasure on
  // every render and lose the height morph between chips.
  const payload = useMemo(() => ({ fieldId: chip.id }), [chip.id]);
  if (showsNameOnly(chip, state.editing)) {
    return null;
  }
  const value = chip.value;
  const summary = summarize(value, chip.field, meta.locale, {
    moreValues: (count) => meta.format("moreValues", { count }),
    quoted: (text) => meta.format("quoted", { text }),
    yes: meta.format("yes"),
    no: meta.format("no"),
  });
  const options = optionsOf(chip.field);
  const icons =
    value.kind !== "option" && value.kind !== "multiOption"
      ? []
      : value.values.slice(0, 3).flatMap((item) => {
          const option = options.find((candidate) => candidate.value === item);
          return option?.icon === undefined ? [] : [option];
        });
  return (
    <ToolbarPrimitive.Button
      ref={segmentRef}
      id={meta.valueId(chip.id)}
      data-slot="data-table-filter-value"
      data-count={value.values.length}
      render={
        <PopoverPrimitive.Trigger
          handle={meta.valueHandle}
          payload={payload}
          render={render ?? <Button variant="ghost" size="sm" />}
        />
      }
      {...definedProps({ "aria-description": summary.full === summary.text ? undefined : summary.full })}
      className={mergeClassName(className, slots.segment(), slots.value())}
      onClick={chain((_event: MouseEvent<HTMLElement>) => {
        assertOverlay("DataTableFilter.Value", meta.hasValueContent(), "no-value-content");
        actions.beginEdit(chip.id);
      }, onClick)}
      {...definedProps(props)}>
      {children ?? (
        <>
          {icons.length > 0 ? (
            <span aria-hidden className={slots.valueIcons()}>
              {icons.map((option) => (
                <span key={option.value} className="contents">
                  {option.icon}
                </span>
              ))}
            </span>
          ) : null}
          <span className={slots.valueText()}>{summary.text}</span>
        </>
      )}
    </ToolbarPrimitive.Button>
  );
}

/** The props of `DataTableFilter.Remove`. */
export type DataTableFilterRemoveProps = Omit<ComponentProps<typeof ToolbarPrimitive.Button>, "render"> & {
  /** The presentation, which replaces the icon Fuse Button. */
  render?: ReactElement;
};

/**
 * Removes the chip, named "Remove Status filter". Focus moves to the next chip, else the previous
 * one, else the Trigger. A press on it closes the chip's open editor and drops any change the
 * editor has not applied, so the removal is the one write. A press that slides off before its click,
 * or whose click a consumer cancels, still closes the editor and drops the change, and the applied
 * filter stays as it was.
 */
export function DataTableFilterRemove({
  className,
  render,
  onClick,
  onPointerDownCapture,
  onClickCapture,
  ref,
  "aria-label": ariaLabel,
  ...props
}: DataTableFilterRemoveProps): ReactElement {
  const chip = useChip("DataTableFilter.Remove");
  const { actions, meta } = useFilterInternals("DataTableFilter.Remove");
  const segmentRef = useSegmentRef(chip.id, ref);
  const label = ariaLabel ?? meta.format("removeFilter", { field: chip.field.label });
  // Before the press blurs the chip's editor or dismisses its overlay, the editor's session pauses.
  // A disabled Remove does nothing, so the press is an ordinary outside press.
  const discard = (event: SyntheticEvent<HTMLElement>) => {
    if (!pressIsDisabled(event)) {
      actions.discardEditors(chip.id);
    }
  };
  return (
    <ToolbarPrimitive.Button
      ref={segmentRef}
      data-slot="data-table-filter-remove"
      aria-label={label}
      // An icon Button requires its own name, and its props win in Base UI's merge.
      render={render ?? <Button variant="ghost" size="icon-sm" aria-label={label} />}
      className={mergeClassName(className, slots.segment())}
      onPointerDownCapture={always(discard, onPointerDownCapture)}
      onClickCapture={always(discard, onClickCapture)}
      onClick={chain((_event: MouseEvent<HTMLElement>) => {
        actions.remove(chip.id);
      }, onClick)}
      {...definedProps(props)}>
      <X aria-hidden />
    </ToolbarPrimitive.Button>
  );
}

/** The props of `DataTableFilter.Clear`. */
export type DataTableFilterClearProps = Omit<ComponentProps<"button">, "ref">;

/**
 * Removes every filter and moves focus to the Trigger, and renders nothing when there are none. A
 * press on it closes any open editor and drops a change the editor has not applied, so the clear is
 * the one write. A press that slides off before its click, or whose click a consumer cancels, still
 * closes the editor and drops the change, and the applied filters stay as they were.
 * In the Bar it joins the toolbar's focus order. Anywhere else under the Root, such as a table's
 * empty state, it is a plain outline button.
 */
export function DataTableFilterClear({
  className,
  children,
  onClick,
  onPointerDownCapture,
  onClickCapture,
  ...props
}: DataTableFilterClearProps): ReactElement | null {
  const { state, actions, meta } = useFilterInternals("DataTableFilter.Clear");
  const inBar = use(BarContext);
  if (state.filters.length === 0) {
    return null;
  }
  const handleClick = chain((_event: MouseEvent<HTMLButtonElement>) => {
    actions.clear();
  }, onClick);
  // Before the press blurs an editor or dismisses its overlay, every editing session pauses. A
  // disabled Clear does nothing, so the press is an ordinary outside press.
  const discard = (event: SyntheticEvent<HTMLElement>) => {
    if (!pressIsDisabled(event)) {
      actions.discardEditors(null);
    }
  };
  const handlePointerDownCapture = always(discard, onPointerDownCapture);
  const handleClickCapture = always(discard, onClickCapture);
  const label = children ?? meta.format("clearFilters");
  return inBar ? (
    <ToolbarPrimitive.Button
      data-slot="data-table-filter-clear"
      // In a narrow bar the label hides behind an icon, and the name never changes.
      {...definedProps({ "aria-label": children === undefined ? meta.format("clearFilters") : undefined })}
      render={<Button variant="ghost" size="sm" />}
      className={mergeClassName(className, slots.clear())}
      onPointerDownCapture={handlePointerDownCapture}
      onClickCapture={handleClickCapture}
      onClick={handleClick}
      {...definedProps(props)}>
      <XCircle aria-hidden className={slots.clearIcon()} />
      <span className={slots.clearLabel()}>{label}</span>
    </ToolbarPrimitive.Button>
  ) : (
    <Button
      data-slot="data-table-filter-clear"
      variant="outline"
      size="sm"
      className={className}
      onPointerDownCapture={handlePointerDownCapture}
      onClickCapture={handleClickCapture}
      onClick={handleClick}
      {...definedProps(props)}>
      {label}
    </Button>
  );
}

DataTableFilterBar.displayName = "DataTableFilter.Bar";
DataTableFilterTrigger.displayName = "DataTableFilter.Trigger";
DataTableFilterChips.displayName = "DataTableFilter.Chips";
DataTableFilterChip.displayName = "DataTableFilter.Chip";
DataTableFilterSubject.displayName = "DataTableFilter.Subject";
DataTableFilterOperator.displayName = "DataTableFilter.Operator";
DataTableFilterValue.displayName = "DataTableFilter.Value";
DataTableFilterRemove.displayName = "DataTableFilter.Remove";
DataTableFilterClear.displayName = "DataTableFilter.Clear";
