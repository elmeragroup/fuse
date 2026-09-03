"use client";

import type { ComponentProps, ReactElement } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { useResolvedPortalContainer } from "../../theme/use-resolved-portal-container";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
} from "../overlay/overlay-classes";
import type { OverlayContainerProps, OverlayPositionerProps } from "../overlay/overlay-props";

function PopoverRoot(props: ComponentProps<typeof PopoverPrimitive.Root>): ReactElement {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  className,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Trigger>): ReactElement {
  return (
    <PopoverPrimitive.Trigger
      data-slot="popover-trigger"
      className={cn(selfFocusRingClass, className)}
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

function PopoverContent({
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
  const resolvedContainer = useResolvedPortalContainer(container);

  if (resolvedContainer === null) {
    return null;
  }

  return (
    <PopoverPrimitive.Portal container={resolvedContainer}>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className={overlayPositionerClass}>
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            selfFocusRingClass,
            overlayPopupSurfaceClass,
            overlayPopupMotionClass,
            "text-sm flex w-72 flex-col gap-4 p-4",
            className
          )}
          {...props}>
          {children}
          {showArrow ? (
            <PopoverPrimitive.Arrow className="relative block h-1.5 w-3 overflow-clip before:absolute before:bottom-0 before:left-1/2 before:h-[calc(6px*sqrt(2))] before:w-[calc(6px*sqrt(2))] before:[transform:translate(-50%,50%)_rotate(45deg)] before:border before:border-border before:bg-popover before:content-[''] data-[side=bottom]:top-[-6px] data-[side=left]:right-[-9px] data-[side=left]:rotate-90 data-[side=right]:left-[-9px] data-[side=right]:-rotate-90 data-[side=top]:bottom-[-6px] data-[side=top]:rotate-180" />
          ) : null}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: ComponentProps<"div">): ReactElement {
  return (
    <div data-slot="popover-header" className={cn("text-sm flex flex-col gap-1", className)} {...props} />
  );
}

function PopoverTitle({ className, ...props }: ComponentProps<typeof PopoverPrimitive.Title>): ReactElement {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-medium text-balance", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Description>): ReactElement {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-pretty text-muted-foreground", className)}
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

export const Popover = {
  Root: PopoverRoot,
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Header: PopoverHeader,
  Title: PopoverTitle,
  Description: PopoverDescription,
};
