"use client";

// The bar is one Base UI Toolbar, so the whole bar is one Tab stop with arrow-key roving. Each chip
// is a Toolbar.Group of Toolbar.Buttons. State and wiring sit on the Base UI part, and the Fuse
// Button is only its `render` element.

import { use, useCallback, useEffect, useMemo, useRef } from "react";
import type {
  ComponentProps,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
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
import { activeElementFrom } from "../../internal/active-element";
import { definedProps } from "../../internal/defined-props";
import { isHTMLElement, isNode } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { Button } from "../button/button";
import { SelectRoot } from "../select/select";
import { chain } from "./chain-handlers";
import {
  assertOverlay,
  BarContext,
  ChipContext,
  useChip,
  useFilterInternals,
} from "./data-table-filter-context";
import type { ChipFilter } from "./data-table-filter-context";
import { dataTableFilterSlots as slots } from "./data-table-filter-variants";
import { optionsOf } from "./filter-fields";
import { isToggleOn } from "./filter-model";
import type { FilterOperator } from "./filter-model";
import { summarize } from "./filter-summary";
import { OperatorOptions, useOperatorItems } from "./operator-options";
import { scrollStripOnWheel } from "./strip-wheel";

/**
 * Runs the consumer's handler, then the part's bookkeeping, whatever the consumer did with the
 * event. A prevented or stopped press still blurs the editor and may still click.
 */
function always<E>(own: (event: E) => void, theirs: ((event: E) => void) | undefined): (event: E) => void {
  return (event) => {
    theirs?.(event);
    own(event);
  };
}

/**
 * Whether Base UI resolved the pressed control as disabled, through its own `disabled` or one
 * inherited from the Bar or the Chip. Toolbar.Button resolves that value from the Toolbar root and
 * group contexts, which a part cannot read, and renders it as the `data-disabled` state attribute.
 * Base UI 1.9 does this in `toolbar/button/ToolbarButton.tsx:35`. Base UI Button, Clear's element
 * outside the bar, renders its own resolved `disabled` the same way. Base UI drops a disabled
 * control's click only in its bubbling handlers, so a capture handler asks this first.
 *
 * @param event - The press event, whose `currentTarget` is the control.
 * @returns `true` when the control is disabled.
 */
function pressIsDisabled(event: SyntheticEvent<HTMLElement>): boolean {
  return event.currentTarget.hasAttribute("data-disabled");
}

/**
 * A ref for one of a chip's segments that also registers it with the Root, so focus can move to
 * it when a neighboring chip is removed. The consumer's ref keeps working.
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

/** Base UI Toolbar Root's props. */
type ToolbarRootProps = ComponentProps<typeof ToolbarPrimitive.Root>;

/** Props for `DataTableFilter.Bar`, which takes Base UI Toolbar Root's props. */
export type DataTableFilterBarProps = ToolbarRootProps & {
  /**
   * The `DataTableFilter.Trigger`, the `DataTableFilter.Chips` and `DataTableFilter.Clear`.
   * Defaults to those three. The bar stays one line high however many filters it holds, so a search
   * field or table beside it never moves. The chips sit in one strip that scrolls sideways, by
   * touch, trackpad, keyboard focus or a vertical mouse wheel, and an end of the strip fades only
   * while chips hide past it. Clear follows the last chip, or sits at the bar's end once the chips
   * overflow. The Trigger is a square icon button named "Filter" at every width. Below a 36rem bar
   * width, Clear hides its label and shows only its icon, and its name stays "Clear filters".
   */
  children?: ToolbarRootProps["children"];
};

/**
 * The filter bar, a toolbar that is one Tab stop with arrow-key roving. It is named "Filters"
 * unless `aria-label` says otherwise. A container query hides Clear's label.
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

/** Props for `DataTableFilter.Trigger`. It omits `id`, which the add menu's handle sets. */
export type DataTableFilterTriggerProps = Omit<
  ComponentProps<typeof ToolbarPrimitive.Button>,
  "render" | "id"
> & {
  /** The presentation, which replaces the outline Fuse Button. The toolbar and menu wiring stay. */
  render?: ReactElement;
};

/**
 * The button that opens the add menu, `DataTableFilter.Content`. It sits first in the bar, so a
 * chip added under the open menu never moves it. Without children it draws the icon, named "Filter"
 * unless `aria-label` says otherwise, as a square icon button at every width or in the `render`
 * element. Children replace the icon and render it as a labeled button.
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
              // oxlint-disable-next-line fuse/render-element-wiring -- the trigger names itself only when icon-only, through a conditional spread on the outer Toolbar.Button, and this icon Button in the same iconOnly branch repeats that name because an icon-size Button requires its own aria-label
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

/**
 * Calls `end` when the press that the pointerdown `event` starts ends, and returns the function that
 * stops listening. A mouse focuses on pointerdown, so its press ends at its pointerup. Touch and pen
 * focus after pointerup, so their press ends only at a pointer cancel. A release outside the strip
 * brings it no click, so the listeners are on the document.
 */
function listenForPressEnd(event: PointerEvent<HTMLElement>, end: () => void): () => void {
  const { pointerId, pointerType } = event;
  const { ownerDocument } = event.currentTarget;
  const onPressEnd = (next: globalThis.PointerEvent) => {
    if (next.pointerId === pointerId && (next.type === "pointercancel" || pointerType === "mouse")) {
      end();
    }
  };
  ownerDocument.addEventListener("pointerup", onPressEnd, true);
  ownerDocument.addEventListener("pointercancel", onPressEnd, true);
  return () => {
    ownerDocument.removeEventListener("pointerup", onPressEnd, true);
    ownerDocument.removeEventListener("pointercancel", onPressEnd, true);
  };
}

/**
 * The elements the pointerdown `event` passes through inside the strip, from its target up to the
 * strip. The strip skips its focus scroll only for a focus on this path. The path keeps the pressed
 * element even after a handler detaches the pressed node. A consumer handler can still focus a
 * control outside the path, and that focus scrolls. The path leaves out the element that already
 * has focus. The press cannot focus that element again, so a later keyboard focus on it still
 * scrolls it into view. A press in a portaled popup reaches the strip's React handler but not its
 * DOM path, so its path is empty.
 */
function pressPath(event: PointerEvent<HTMLElement>): ReadonlyArray<EventTarget> {
  const strip = event.currentTarget;
  const path = event.nativeEvent.composedPath();
  const end = path.indexOf(strip);
  const focused = activeElementFrom(strip);
  return end === -1 ? [] : path.slice(0, end).filter((element) => element !== focused);
}

/** Props for `DataTableFilter.Chips`. */
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
 * mouse wheel scrolls the strip until it reaches an end. The strip skips its focus scroll when a
 * primary pointer press focuses the segment. The strip reveals a `DataTableFilter.Value`'s chip
 * once a press opens the value popover on it or moves the popover to it.
 */
export function DataTableFilterChips({
  className,
  children,
  onFocus,
  onPointerDownCapture,
  onClickCapture,
  ref,
  ...props
}: DataTableFilterChipsProps): ReactElement {
  const { state } = useFilterInternals("DataTableFilter.Chips");
  const stripRef = useMergedRefs(ref, scrollStripOnWheel);
  // A primary pointer press's path through the strip, with the function that stops listening for
  // the press's end. The record lasts from the pointerdown until the strip's next focus or click, or
  // until the press ends without either. Only event handlers read and write it.
  const press = useRef<{ readonly path: ReadonlyArray<EventTarget>; readonly stop: () => void } | null>(null);
  const forgetPress = () => {
    press.current?.stop();
    press.current = null;
  };
  // A strip that unmounts or hides mid-press, before the focus or click that would end it, forgets it.
  useEffect(
    () => () => {
      press.current?.stop();
      press.current = null;
    },
    []
  );
  return (
    <div
      ref={stripRef}
      data-slot="data-table-filter-chips"
      className={cn(slots.chips(), className)}
      onFocus={(event: FocusEvent<HTMLDivElement>) => {
        onFocus?.(event);
        // A mouse press focuses its segment on pointerdown, before the release. A scroll then would
        // move the segment out from under the pointer. Base UI's Select opens an Operator's list on
        // mousedown and cancels the opening when the mouseup lands outside both the trigger and the
        // list, which a scroll can cause. A Value's click would not land, and an open popover would
        // follow its old chip out of the strip.
        const pressed = press.current?.path.includes(event.target) ?? false;
        forgetPress();
        if (pressed || event.defaultPrevented || !isHTMLElement(event.target)) {
          return;
        }
        event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }}
      onPointerDownCapture={(event: PointerEvent<HTMLDivElement>) => {
        // The strip's capture runs before any handler inside it, and the consumer's capture runs
        // after the record, so a handler that focuses the segment still meets the record.
        forgetPress();
        const path = pressPath(event);
        if (event.isPrimary && event.button === 0 && path.length > 0) {
          press.current = { path, stop: listenForPressEnd(event, forgetPress) };
        }
        onPointerDownCapture?.(event);
      }}
      onClickCapture={(event: MouseEvent<HTMLDivElement>) => {
        onClickCapture?.(event);
        forgetPress();
      }}
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

/** Props for `DataTableFilter.Chip`, which takes Base UI Toolbar Group's props. */
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
        // Delete and Backspace remove the chip only from its own segments, since a portaled Select
        // popup bubbles its keys through the React tree too. A chip that the Bar or its own
        // `disabled` disables stays, and so does a chip whose focused segment is disabled. Both
        // checks read the `data-disabled` state Base UI resolves.
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

/** Props for `DataTableFilter.Subject`. */
export type DataTableFilterSubjectProps = ComponentProps<"span">;

/** The field's icon and name. It is static text, never a Tab or arrow-key stop. */
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

/** Props for `DataTableFilter.Operator`. */
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
 * Whether a chip shows only its name and Remove. A toggle that is on does, unless its value popover
 * is open, where it keeps its whole sentence until the popover closes.
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

/** Props for `DataTableFilter.Value`. It omits `id`, which the value popover's handle sets. */
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
  const { registerValue } = actions;
  const register = useCallback(
    (element: HTMLElement | null) => {
      registerValue(chip.id, element);
    },
    [registerValue, chip.id]
  );
  const segmentRef = useSegmentRef(chip.id, useMergedRefs(ref, register));
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

/** Props for `DataTableFilter.Remove`. */
export type DataTableFilterRemoveProps = Omit<ComponentProps<typeof ToolbarPrimitive.Button>, "render"> & {
  /** The presentation, which replaces the icon Fuse Button. */
  render?: ReactElement;
};

/**
 * The button that removes the chip, named "Remove Status filter". Focus moves to the next chip,
 * else the previous one, else the Trigger. A press on it closes the chip's open editor and drops
 * any change the editor has not applied, so the removal is the one write. A press that slides off
 * before its click, or whose click a consumer cancels, still closes the editor and drops the
 * change, and the applied filter stays as it was.
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

/** Props for `DataTableFilter.Clear`. */
export type DataTableFilterClearProps = Omit<ComponentProps<"button">, "ref">;

/**
 * The button that removes every filter and moves focus to the Trigger. It renders nothing when
 * there are none. A press on it closes any open editor and drops a change the editor has not
 * applied, so the clear is the one write. A press that slides off before its click, or whose click
 * a consumer cancels, still closes the editor and drops the change, and the applied filters stay as
 * they were. In the Bar it joins the toolbar's focus order. Anywhere else under the Root, such as a
 * table's empty state, it is a plain outline button.
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
