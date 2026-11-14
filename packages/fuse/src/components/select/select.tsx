"use client";

import type { ComponentProps, ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { Check } from "../../icons/generated/check";
import { definedProps } from "../../internal/defined-props";
import { mergeClassName } from "../../styles/merge-class-name";
import { overlayPositionerClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";
import { selectContentVariants, selectTriggerVariants } from "./select-variants";

const selectContentSlots = selectContentVariants();

/** Holds the Select's value and open state. Its parts go inside it. */
export function SelectRoot<Value = unknown, Multiple extends boolean | undefined = false>(
  props: SelectRootType.Props<Value, Multiple>
): ReactElement {
  return <SelectPrimitive.Root {...props} />;
}

/** The props of {@link SelectTrigger}. */
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
      {...definedProps(props)}>
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

/** The props of {@link SelectContent}. */
export type SelectContentProps = ComponentProps<typeof SelectPrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof SelectPrimitive.Positioner>> & {
    /**
     * Places the popup over the trigger, with the selected item on the trigger's value, as macOS
     * menus do. Emitted as `data-align-trigger`. While it is on, the popup skips its entrance
     * animation. It does not apply to touch input, and it turns off when the popup does not fit.
     * The popup then opens on `side`. Pass `false` to open beside the trigger on `side` and `align`
     * every time.
     *
     * Item alignment places the popup in viewport coordinates (a Base UI 1.8 limitation). When
     * the portal target, or one of its ancestors, is the containing block for fixed-position
     * content, such as a transformed or `contain: paint` scope, pass `false` so the popup opens
     * beside its trigger instead of off by the scope's offset.
     */
    alignItemWithTrigger?: ComponentProps<typeof SelectPrimitive.Positioner>["alignItemWithTrigger"];
  } & OverlayContainerProps;

/** The popup that lists the options, portalled with its positioner and scroll arrows. */
export function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  container,
  ...props
}: SelectContentProps): ReactElement | null {
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
          {...props}>
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
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

/** The arrow at the top of a popup that scrolls. `Select.Content` renders one. */
export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={mergeClassName(
        className,
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover [--surface-muted-foreground:inherit] [--surface:inherit] py-1 [&_svg:not([class*='size-'])]:size-4"
      )}
      {...props}>
      <CaretUp />
    </SelectPrimitive.ScrollUpArrow>
  );
}

/** The arrow at the bottom of a popup that scrolls. `Select.Content` renders one. */
export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={mergeClassName(
        className,
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover [--surface-muted-foreground:inherit] [--surface:inherit] py-1 [&_svg:not([class*='size-'])]:size-4"
      )}
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
