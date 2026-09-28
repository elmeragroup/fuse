"use client";

import type { ComponentProps, ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { Check } from "../../icons/generated/check";
import { handoff } from "../../internal/part-handoff";
import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
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
import { selectTriggerSize } from "./select-variants";

export function SelectRoot<Value = unknown, Multiple extends boolean | undefined = false>(
  props: SelectRootType.Props<Value, Multiple>
): ReactElement {
  return <SelectPrimitive.Root {...handoff(props)} />;
}

export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  /**
   * Control size of the trigger box. Emitted as `data-size`. `"default"` maps to the `md`
   * control size; `"sm"` maps to the `sm` control size.
   * @default "default"
   */
  size?: "sm" | "default";
};

export function SelectTrigger({ size = "default", children, ...props }: SelectTriggerProps): ReactElement {
  return (
    <SelectPrimitive.Trigger
      {...handoff(props, {
        defaults: { "data-slot": "select-trigger", "data-size": size },
        // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- value-slot gap is content layout, not a control rung
        classes: [
          selfFocusRingClass,
          fieldBoxChromeClass,
          nativeStateFaceClass,
          dataStateFaceClass,
          selectTriggerSize({ size }),
          // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
          "group/select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none select-none data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        ],
      })}>
      {children}
      <SelectPrimitive.Icon
        render={
          <CaretDown className="ease-in-out pointer-events-none size-4 text-muted-foreground transition-transform duration-200 group-data-[popup-open]/select-trigger:rotate-180" />
        }
      />
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value>): ReactElement {
  return (
    <SelectPrimitive.Value
      {...handoff(props, { defaults: { "data-slot": "select-value" }, classes: ["flex flex-1 text-left"] })}
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

export function SelectContent({
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
          {...handoff(props, {
            defaults: {
              "data-slot": "select-content",
              "data-align-trigger": alignItemWithTrigger ? "true" : "false",
            },
            classes: [
              overlayTimedPopupClass,
              "relative max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-lg data-[align-trigger=true]:animate-none",
            ],
          })}>
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </OverlayPortal>
  );
}

export function SelectItem({
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>): ReactElement {
  return (
    <SelectPrimitive.Item
      {...handoff(props, {
        defaults: { "data-slot": "select-item" },
        // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- option padding is menu layout, not a control rung
        classes: [
          menuItemClass,
          // oxlint-disable-next-line elmera/no-local-focus-ring -- the highlight face menuItemClass leaves to the family; base-ui spells it `focus:` on Select items
          "w-full pr-8 pl-2 focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        ],
      })}>
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator render={<span className={cn(menuItemIndicatorClass, "size-4")} />}>
        <Check className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectGroup(props: ComponentProps<typeof SelectPrimitive.Group>): ReactElement {
  return (
    <SelectPrimitive.Group
      {...handoff(props, { defaults: { "data-slot": "select-group" }, classes: ["scroll-my-1 p-1"] })}
    />
  );
}

export function SelectLabel(props: ComponentProps<typeof SelectPrimitive.GroupLabel>): ReactElement {
  return (
    <SelectPrimitive.GroupLabel
      {...handoff(props, { defaults: { "data-slot": "select-label" }, classes: [menuGroupLabelClass] })}
    />
  );
}

export function SelectSeparator(props: ComponentProps<typeof SelectPrimitive.Separator>): ReactElement {
  return (
    <SelectPrimitive.Separator
      {...handoff(props, {
        defaults: { "data-slot": "select-separator" },
        classes: [menuSeparatorClass, "pointer-events-none"],
      })}
    />
  );
}

export function SelectScrollUpButton(
  props: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>
): ReactElement {
  return (
    <SelectPrimitive.ScrollUpArrow
      {...handoff(props, {
        defaults: { "data-slot": "select-scroll-up-button" },
        classes: [
          "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        ],
      })}>
      <CaretUp />
    </SelectPrimitive.ScrollUpArrow>
  );
}

export function SelectScrollDownButton(
  props: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>
): ReactElement {
  return (
    <SelectPrimitive.ScrollDownArrow
      {...handoff(props, {
        defaults: { "data-slot": "select-scroll-down-button" },
        classes: [
          "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        ],
      })}>
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
