"use client";

import type { ComponentProps, ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { Check } from "../../icons/generated/check";
import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { selfFocusRingClass } from "../../styles/utils";
import {
  menuGroupLabelClass,
  menuItemClass,
  menuItemIndicatorClass,
  menuSeparatorClass,
  overlayPositionerClass,
  overlayTimedPopupClass,
} from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";

function SelectRoot<Value = unknown, Multiple extends boolean | undefined = false>(
  props: SelectRootType.Props<Value, Multiple>
): ReactElement {
  return <SelectPrimitive.Root {...props} />;
}

export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  /**
   * Control-box height. Emitted as `data-size`. `"default"` maps to the `md` density
   * rung; `"sm"` maps to the `sm` rung.
   * @default "default"
   */
  size?: "sm" | "default";
};

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps): ReactElement {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- select.md §4: value-slot gap is content layout, not a control rung
      className={cn(
        selfFocusRingClass,
        fieldBoxChromeClass,
        // oxlint-disable-next-line elmera/no-local-focus-ring -- select.md §7: native outline off; ring comes from the shared adapter
        "group/select-trigger data-[size=sm]:text-sm flex w-fit items-center justify-between whitespace-nowrap outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 data-placeholder:text-muted-foreground data-[size=default]:h-(--control-h-md) data-[size=default]:gap-(--control-gap-md) data-[size=default]:px-(--control-px-md) data-[size=default]:[font-size:var(--control-text)] data-[size=default]:[line-height:var(--control-leading)] data-[size=sm]:h-(--control-h-sm) data-[size=sm]:gap-(--control-gap-sm) data-[size=sm]:px-(--control-px-sm) *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}>
      {children}
      <SelectPrimitive.Icon
        render={
          <CaretDown className="ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/select-trigger:rotate-180" />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: ComponentProps<typeof SelectPrimitive.Value>): ReactElement {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      {...props}
    />
  );
}

export type SelectContentProps = ComponentProps<typeof SelectPrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof SelectPrimitive.Positioner>> & {
    /**
     * macOS-style: the selected item overlays the trigger. Emitted as `data-align-trigger`.
     * Entrance animation is suppressed while this is on, so the popup appears in place.
     * @default true
     */
    alignItemWithTrigger?: ComponentProps<typeof SelectPrimitive.Positioner>["alignItemWithTrigger"];
  } & OverlayContainerProps;

function SelectContent({
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
          className={cn(
            overlayTimedPopupClass,
            "relative max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-lg data-[align-trigger=true]:animate-none",
            className
          )}
          {...props}>
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </OverlayPortal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>): ReactElement {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- select.md §4: option padding is menu layout, not a control rung
      className={cn(
        menuItemClass,
        // oxlint-disable-next-line elmera/no-local-focus-ring -- select.md §7: the highlight face menuItemClass leaves to the family; base-ui spells it `focus:` on Select items
        "w-full pr-8 pl-2 focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}>
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span className={cn(menuItemIndicatorClass, "size-4")} />}>
        <Check className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectGroup({ className, ...props }: ComponentProps<typeof SelectPrimitive.Group>): ReactElement {
  return (
    <SelectPrimitive.Group data-slot="select-group" className={cn("scroll-my-1 p-1", className)} {...props} />
  );
}

function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.GroupLabel>): ReactElement {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(menuGroupLabelClass, className)}
      {...props}
    />
  );
}

function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>): ReactElement {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(menuSeparatorClass, "pointer-events-none", className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}>
      <CaretUp />
    </SelectPrimitive.ScrollUpArrow>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
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

export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
  Group: SelectGroup,
  Label: SelectLabel,
  Separator: SelectSeparator,
  ScrollUpButton: SelectScrollUpButton,
  ScrollDownButton: SelectScrollDownButton,
};
