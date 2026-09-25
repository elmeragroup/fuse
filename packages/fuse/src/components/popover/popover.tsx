"use client";

import type { ComponentProps, ReactElement } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { overlayPositionerClass, overlayTimedPopupClass } from "../overlay/overlay-classes";
import { OverlayPortal } from "../overlay/overlay-portal";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";

export function PopoverRoot(props: ComponentProps<typeof PopoverPrimitive.Root>): ReactElement {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger({
  className,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Trigger>): ReactElement {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={mergeClassName(className, selfFocusRingClass)}
      {...props}
    />
  );
}

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Popup> &
  OverlayPositionerProps<ComponentProps<typeof PopoverPrimitive.Positioner>> & {
    /**
     * Renders the placement arrow after `children`. Off by default.
     */
    showArrow?: boolean;
  } & OverlayContainerProps;

export function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  showArrow = false,
  children,
  container,
  ...props
}: PopoverContentProps): ReactElement | null {
  return (
    <OverlayPortal portal={PopoverPrimitive.Portal} container={container}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={overlayPositionerClass}>
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={mergeClassName(
            className,
            selfFocusRingClass,
            overlayTimedPopupClass,
            "text-sm flex w-72 flex-col gap-4 p-4"
          )}
          {...props}>
          {children}
          {showArrow ? (
            <PopoverPrimitive.Arrow className="relative block h-1.5 w-3 overflow-clip before:absolute before:bottom-0 before:left-1/2 before:h-[calc(6px*sqrt(2))] before:w-[calc(6px*sqrt(2))] before:[transform:translate(-50%,50%)_rotate(45deg)] before:border before:border-border before:bg-popover before:content-[''] data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180" />
          ) : null}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </OverlayPortal>
  );
}

export function PopoverHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div data-slot="popover-header" className={cn("text-sm flex flex-col gap-1", className)} {...props} />
  );
}

export function PopoverTitle({
  className,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Title>): ReactElement {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={mergeClassName(className, "font-medium text-balance")}
      {...props}
    />
  );
}

export function PopoverDescription({
  className,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Description>): ReactElement {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={mergeClassName(className, "text-pretty text-muted-foreground")}
      {...props}
    />
  );
}

PopoverRoot.displayName = "Popover.Root";
PopoverTrigger.displayName = "Popover.Trigger";
PopoverContent.displayName = "Popover.Content";
PopoverHeader.displayName = "Popover.Header";
PopoverTitle.displayName = "Popover.Title";
PopoverDescription.displayName = "Popover.Description";
