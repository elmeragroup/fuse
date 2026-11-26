"use client";

import { useRef } from "react";
import type { ComponentProps, ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { Check } from "../../icons/generated/check";
import { definedProps } from "../../internal/defined-props";
import { mergeClassName } from "../../styles/merge-class-name";
import type { SkeletonPart } from "../../theme/tokens/skeleton-roles";
import { overlayPositionerClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { selectContentVariants, selectTriggerVariants } from "./select-variants";

const selectContentSlots = selectContentVariants();

/** The root that holds the Select's value and open state. Its parts go inside it. */
export function SelectRoot<Value = unknown, Multiple extends boolean | undefined = false>(
  props: SelectRootType.Props<Value, Multiple>
): ReactElement {
  return <SelectPrimitive.Root {...props} />;
}

/** Props for {@link SelectTrigger}. */
export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  /**
   * The trigger's control size, emitted as `data-size`. `default` is the md control size, and
   * `sm` the sm one.
   */
  size?: "sm" | "default";
};

/** The button that opens the popup and shows `Select.Value` beside a caret. */
export function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps): ReactElement {
  const slots = selectTriggerVariants({ size });
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={mergeClassName(className, slots.trigger())}
      {...definedProps(props)}
      data-skeleton-part={"select-trigger" satisfies SkeletonPart}>
      {children}
      <SelectPrimitive.Icon render={<CaretDown className={slots.caret()} />} />
    </SelectPrimitive.Trigger>
  );
}

/** The selected option's label, or the placeholder while nothing is selected. */
export function SelectValue({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Value>): ReactElement {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={mergeClassName(className, selectTriggerVariants().value())}
      {...props}
    />
  );
}

/** Props for {@link SelectContent}. */
export type SelectContentProps = Omit<
  ComponentProps<typeof SelectPrimitive.Popup>,
  "onScroll" | "onScrollEnd"
> &
  OverlayPositionerProps<ComponentProps<typeof SelectPrimitive.Positioner>> & {
    /**
     * Called when the list of options scrolls. The list scrolls inside the popup, so
     * `event.currentTarget` is the `listbox` element, not the popup. Pass scroll listeners here.
     * An `onScroll` on the `render` element never fires, because the popup does not scroll.
     */
    onScroll?: ComponentProps<typeof SelectPrimitive.List>["onScroll"];
    /**
     * Called when the list of options stops scrolling. Like `onScroll`, it fires on the list, so
     * `event.currentTarget` is the `listbox` element. An `onScrollEnd` on the `render` element
     * never fires. It forwards the native `scrollend` event, which Chrome fires from 114 and Safari
     * from 26.2, so it never fires in Chrome 111 to 113 or Safari 16.4 to 26.1.
     */
    onScrollEnd?: ComponentProps<typeof SelectPrimitive.List>["onScrollEnd"];
    /**
     * Whether the popup opens over the trigger, with the selected item on the trigger's value, as
     * macOS menus do. Emitted as `data-align-trigger`. While it is on, the popup skips its entrance
     * animation. It does not apply to touch input, and it turns off when the popup does not fit.
     * The popup then opens on `side`. Pass `false` to open beside the trigger on `side` and `align`
     * every time.
     *
     * Item alignment places the popup in viewport coordinates, a Base UI 1.8 limitation. When
     * the portal target, or one of its ancestors, is the containing block for fixed-position
     * content, such as a transformed or `contain: paint` scope, pass `false` so the popup opens
     * beside its trigger instead of off by the scope's offset.
     */
    alignItemWithTrigger?: ComponentProps<typeof SelectPrimitive.Positioner>["alignItemWithTrigger"];
  } & OverlayContainerProps;

/** The popup that lists the options, portaled with its positioner and scroll arrows. */
export function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  container,
  onScroll,
  onScrollEnd,
  onKeyDown,
  ...props
}: SelectContentProps): ReactElement | null {
  const listRef = useRef<HTMLDivElement>(null);
  // Base UI focuses the popup while no option is highlighted, as after a mouse open, and leaves
  // PageUp and PageDown to the browser, which scrolls the focused element. The list scrolls here,
  // not the popup, so the popup pages the list itself and focus stays where Base UI put it. A page
  // is the list's height less its scroll padding, the arrow at each end, so the row under the down
  // arrow starts the next page clear of the up arrow. A list no taller than its padding pages by
  // its whole height. A list that cannot scroll in the key's direction leaves the key to the
  // browser, which scrolls the page when no scroll lock holds it. A consumer's `preventDefault()` or
  // `preventBaseUIHandler()` cancels it.
  const handleKeyDown: SelectContentProps["onKeyDown"] = (event) => {
    onKeyDown?.(event);
    const list = listRef.current;
    if (
      list === null ||
      (event.key !== "PageDown" && event.key !== "PageUp") ||
      event.target !== event.currentTarget ||
      event.defaultPrevented ||
      event.baseUIHandlerPrevented === true
    ) {
      return;
    }
    const down = event.key === "PageDown";
    const style = getComputedStyle(list);
    const padding =
      (Number.parseFloat(style.scrollPaddingTop) || 0) + (Number.parseFloat(style.scrollPaddingBottom) || 0);
    const usable = list.clientHeight - padding;
    const page = usable > 0 ? usable : list.clientHeight;
    // Scroll at once and keep the key only if the list moved. Measuring the room left first fails
    // at a browser zoom, where rounding makes a list at its end report room and one with a sliver
    // of room report none.
    const before = list.scrollTop;
    list.scrollBy({ top: down ? page : -page, behavior: "instant" });
    if (list.scrollTop !== before) {
      event.preventDefault();
    }
  };
  return (
    <OverlayPortal portal={SelectPrimitive.Portal} container={container}>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className={overlayPositionerClass}>
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger ? "true" : "false"}
          className={mergeClassName(className, selectContentSlots.content())}
          {...props}
          onKeyDown={handleKeyDown}>
          {/* Chromium puts a scroller with no tabbable descendant in the Tab order. `tabIndex={-1}`
              keeps the list out of it, so Tab leaves the popup and closes it. */}
          <SelectPrimitive.List
            ref={listRef}
            tabIndex={-1}
            className={selectContentSlots.list()}
            {...definedProps({ onScroll, onScrollEnd })}>
            <SelectScrollUpButton className={selectContentSlots.listScrollUpArrow()} />
            {children}
            <SelectScrollDownButton className={selectContentSlots.listScrollDownArrow()} />
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </OverlayPortal>
  );
}

/** An option, with its label and a check while it is selected. */
export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>): ReactElement {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={mergeClassName(className, selectContentSlots.item())}
      {...props}>
      <SelectPrimitive.ItemText className={selectContentSlots.itemText()}>
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span className={selectContentSlots.itemIndicator()} />}>
        <Check className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

/**
 * A group of options. It pads its rows inside the popup's corner and publishes
 * `--inner-corner`, so a custom block in the group with `rounded-inner` rounds like its rows.
 * `Select.Content` publishes the popup's own corner for rows and blocks outside a group.
 */
export function SelectGroup({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Group>): ReactElement {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={mergeClassName(className, selectContentSlots.group())}
      {...props}
    />
  );
}

/** The label of a `Select.Group`. */
export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.GroupLabel>): ReactElement {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={mergeClassName(className, selectContentSlots.label())}
      {...props}
    />
  );
}

/** A line between groups of options. */
export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>): ReactElement {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={mergeClassName(className, selectContentSlots.separator())}
      {...props}
    />
  );
}

/**
 * The arrow that covers the top edge of the list while the list can scroll up. Hovering it scrolls
 * the list up. `Select.Content` renders one inside its list. One composed anywhere else keeps Base
 * UI's absolute position, so give its popup `position: relative`.
 */
export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={mergeClassName(className, selectContentSlots.scrollUpArrow())}
      {...props}>
      <CaretUp />
    </SelectPrimitive.ScrollUpArrow>
  );
}

/**
 * The arrow that covers the bottom edge of the list while the list can scroll down. Hovering it
 * scrolls the list down. `Select.Content` renders one inside its list. One composed anywhere else
 * keeps Base UI's absolute position, so give its popup `position: relative`.
 */
export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={mergeClassName(className, selectContentSlots.scrollDownArrow())}
      {...props}>
      <CaretDown />
    </SelectPrimitive.ScrollDownArrow>
  );
}

SelectRoot.displayName = "Select.Root";
SelectTrigger.displayName = "Select.Trigger";
SelectValue.displayName = "Select.Value";
SelectContent.displayName = "Select.Content";
SelectItem.displayName = "Select.Item";
SelectGroup.displayName = "Select.Group";
SelectLabel.displayName = "Select.Label";
SelectSeparator.displayName = "Select.Separator";
SelectScrollUpButton.displayName = "Select.ScrollUpButton";
SelectScrollDownButton.displayName = "Select.ScrollDownButton";
