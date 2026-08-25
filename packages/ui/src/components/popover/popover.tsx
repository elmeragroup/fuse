"use client";

import type { ComponentProps, ReactElement, RefObject } from "react";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";
import { useThemeScopeContainer } from "../../theme/theme-scope-container";
import { overlayLayer } from "../overlay/overlay-classes";

/** Resolved once at module scope — the recipe below does the same (no per-render work). */
const selfFocusRing = focusRing({ target: "self" }).root();

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
      className={cn(selfFocusRing, className)}
      {...props}
    />
  );
}

export type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Popup> & {
  /**
   * How the popup aligns to the trigger on the cross axis.
   * @default "center"
   */
  align?: ComponentProps<typeof PopoverPrimitive.Positioner>["align"];
  /**
   * Offset along the alignment axis, in pixels.
   * @default 0
   */
  alignOffset?: ComponentProps<typeof PopoverPrimitive.Positioner>["alignOffset"];
  /**
   * Which side of the trigger the popup is placed on.
   * @default "bottom"
   */
  side?: ComponentProps<typeof PopoverPrimitive.Positioner>["side"];
  /**
   * Distance from the trigger, in pixels.
   * @default 4
   */
  sideOffset?: ComponentProps<typeof PopoverPrimitive.Positioner>["sideOffset"];
  /**
   * Renders the placement arrow after `children`. Off by default.
   */
  showArrow?: boolean;
  /**
   * Portal target for the popup. Defaults to the nearest enclosing `ThemeScope`
   * element, so an overlay never escapes the theme that opened it.
   */
  container?: HTMLElement | RefObject<HTMLElement | null>;
};

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
  const resolvedContainer = useThemeScopeContainer(container);

  // theming.md §7.4: an explicit ref or an enclosing ThemeScope whose element is not
  // attached yet means wait — never a brief escape to the document body. Only an absent
  // scope (`undefined`) leaves the primitive default in place.
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
        className={cn("isolate", overlayLayer)}>
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "text-sm shadow-md flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-md bg-popover p-4 text-popover-foreground ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
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
