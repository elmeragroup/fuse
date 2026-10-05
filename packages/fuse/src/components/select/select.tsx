"use client";

import { createContext, use, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps, ReactElement } from "react";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import type { SelectRoot as SelectRootType } from "@base-ui/react/select";

import { CaretDown } from "../../icons/generated/caret-down";
import { CaretUp } from "../../icons/generated/caret-up";
import { Check } from "../../icons/generated/check";
import { cn } from "../../styles/cn";
import { fieldBoxChromeClass } from "../../styles/field-box";
import { mergeClassName } from "../../styles/merge-class-name";
import { dataStateFaceClass, nativeStateFaceClass } from "../../styles/state-face";
import { selfFocusRingClass } from "../../styles/utils";
import { useResolvedPortalContainer } from "../../theme/theme-scope-container";
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
import { fixedPositionsAgainstViewport } from "./fixed-containing-block";
import { selectTriggerSize } from "./select-variants";

type SelectOpening = {
  /**
   * Registers the content's measurement of its fixed-position containing block, which the root
   * runs as the user opens the popup. Returns the function that unregisters it.
   */
  readonly register: (measure: () => void) => () => void;
  /** Whether the popup was open on the root's first render, before any measurement. */
  readonly openAtMount: boolean;
  /** Whether the host controls `open`, so the popup can open without an open change. */
  readonly hostControlsOpen: boolean;
};

const SelectOpeningContext = createContext<SelectOpening | null>(null);

export function SelectRoot<Value = unknown, Multiple extends boolean | undefined = false>({
  onOpenChange,
  ...props
}: SelectRootType.Props<Value, Multiple>): ReactElement {
  const measure = useRef<(() => void) | null>(null);
  const [openAtMount] = useState(props.open ?? props.defaultOpen ?? false);
  const hostControlsOpen = props.open !== undefined;
  const opening = useMemo(
    (): SelectOpening => ({
      register: (next) => {
        measure.current = next;
        return () => {
          if (measure.current === next) {
            measure.current = null;
          }
        };
      },
      openAtMount,
      hostControlsOpen,
    }),
    [openAtMount, hostControlsOpen]
  );
  return (
    <SelectOpeningContext.Provider value={opening}>
      <SelectPrimitive.Root
        {...props}
        onOpenChange={(open, eventDetails) => {
          onOpenChange?.(open, eventDetails);
          if (open && !eventDetails.isCanceled) {
            measure.current?.();
          }
        }}
      />
    </SelectOpeningContext.Provider>
  );
}

export type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> & {
  /**
   * Control size of the trigger box. Emitted as `data-size`. `"default"` maps to the `md`
   * control size; `"sm"` maps to the `sm` control size.
   * @default "default"
   */
  size?: "sm" | "default";
};

export function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps): ReactElement {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- value-slot gap is content layout, not a control rung
      className={mergeClassName(
        className,
        selfFocusRingClass,
        fieldBoxChromeClass,
        nativeStateFaceClass,
        dataStateFaceClass,
        selectTriggerSize({ size }),
        // oxlint-disable-next-line elmera/no-local-focus-ring -- native outline off; ring comes from the shared adapter
        "group/select-trigger flex w-fit items-center justify-between whitespace-nowrap outline-none select-none data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
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

export function SelectValue({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Value>): ReactElement {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={mergeClassName(className, "flex flex-1 text-left")}
      {...props}
    />
  );
}

export type SelectContentProps = ComponentProps<typeof SelectPrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof SelectPrimitive.Positioner>> & {
    /**
     * macOS-style: the selected item overlays the trigger. Emitted as `data-align-trigger`.
     * Entrance animation is suppressed while this is on, so the popup appears in place.
     *
     * Item alignment places the popup in viewport coordinates, so it applies only while
     * the viewport is the fixed-position containing block of the portal target: the
     * enclosing `ThemeScope`, `container` or the body. When an ancestor of that target,
     * such as a transformed one, contains fixed content instead, the popup opens beside
     * its trigger, even when this is `true`. Fuse measures this each time the user opens the
     * popup. A popup the host controls through `open`, or one open from the first render,
     * is also measured after the content mounts and whenever the portal target resizes.
     * A popup open from the first render (`defaultOpen`) appears once the first measurement lands.
     * @default true
     */
    alignItemWithTrigger?: ComponentProps<typeof SelectPrimitive.Positioner>["alignItemWithTrigger"];
  } & OverlayContainerProps;

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
  const resolved = useResolvedPortalContainer(container);
  const opening = use(SelectOpeningContext);
  // Base UI writes item-aligned coordinates from the viewport into a `position: fixed` box,
  // which an ancestor holding fixed content would offset a second time. Base UI copies
  // `alignItemWithTrigger` when its positioner mounts and in renders where the popup is not yet
  // mounted, which includes the render that opens it. So a popup open from the first render
  // waits for the first measurement before its positioner mounts, and the root measures as the
  // user opens the popup, in the same update as the open state. Only a popup that can open
  // without that open change keeps measuring at mount and on every portal target resize: one a
  // host controls through `open`, one open from the first render, or content outside a Fuse root.
  // An uncontrolled popup opens only through the open change, so it skips the observer and its
  // forced layout, which would otherwise run for every closed Select on the page. Without a
  // scope or `container`, Base UI portals into the body.
  const [containingBlock, setContainingBlock] = useState<"unmeasured" | "viewport" | "ancestor">(
    "unmeasured"
  );
  useEffect(() => {
    if (resolved === null) {
      return;
    }
    const target = resolved ?? document.body;
    const measure = () => {
      setContainingBlock(fixedPositionsAgainstViewport(target) ? "viewport" : "ancestor");
    };
    const opensWithoutOpenChange = opening === null || opening.openAtMount || opening.hostControlsOpen;
    const observer = opensWithoutOpenChange ? new ResizeObserver(measure) : null;
    observer?.observe(target);
    const unregister = opening?.register(measure);
    return () => {
      observer?.disconnect();
      unregister?.();
    };
  }, [resolved, opening]);
  if (resolved === null) {
    return null;
  }
  const aligned = alignItemWithTrigger && containingBlock === "viewport";
  const awaitingMeasurement =
    alignItemWithTrigger && containingBlock === "unmeasured" && opening?.openAtMount !== false;
  return (
    <OverlayPortal portal={SelectPrimitive.Portal} container={resolved}>
      {awaitingMeasurement ? null : (
        <SelectPrimitive.Positioner
          side={side}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          alignItemWithTrigger={aligned}
          className={overlayPositionerClass}>
          <SelectPrimitive.Popup
            data-slot="select-content"
            data-align-trigger={aligned ? "true" : "false"}
            className={mergeClassName(
              className,
              overlayTimedPopupClass,
              "relative max-h-(--available-height) w-(--anchor-width) min-w-36 overflow-x-hidden overflow-y-auto rounded-lg data-[align-trigger=true]:animate-none"
            )}
            {...props}>
            <SelectScrollUpButton />
            <SelectPrimitive.List>{children}</SelectPrimitive.List>
            <SelectScrollDownButton />
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      )}
    </OverlayPortal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>): ReactElement {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- option padding is menu layout, not a control rung
      className={mergeClassName(
        className,
        menuItemClass,
        // oxlint-disable-next-line elmera/no-local-focus-ring -- the highlight face menuItemClass leaves to the family; base-ui spells it `focus:` on Select items
        "w-full pr-8 pl-2 focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
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

export function SelectGroup({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Group>): ReactElement {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={mergeClassName(className, "scroll-my-1 p-1")}
      {...props}
    />
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.GroupLabel>): ReactElement {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={mergeClassName(className, menuGroupLabelClass)}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>): ReactElement {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={mergeClassName(className, menuSeparatorClass, "pointer-events-none")}
      {...props}
    />
  );
}

export function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={mergeClassName(
        className,
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4"
      )}
      {...props}>
      <CaretUp />
    </SelectPrimitive.ScrollUpArrow>
  );
}

export function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownArrow>): ReactElement {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={mergeClassName(
        className,
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4"
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
