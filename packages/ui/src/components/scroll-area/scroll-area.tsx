"use client";

import type { ComponentProps, ReactElement } from "react";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";

import { cn } from "../../styles/cn";
import { focusRing } from "../../styles/utils";

type ScrollAreaType = "auto" | "always" | "hover";

type ScrollAreaRootProps = ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /**
   * Which single scrollbar `Root` renders. For two-axis scrolling, compose the base-ui
   * primitives directly and mount two `ScrollArea.Bar`s.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * Scrollbar visibility, mapped onto base-ui's `keepMounted` plus opacity:
   * `hover` reveals on hover or scroll, `always` keeps the bar mounted and visible,
   * `auto` mounts it only while the content overflows.
   */
  type?: ScrollAreaType;
};

type ScrollAreaBarProps = ComponentProps<typeof ScrollAreaPrimitive.Scrollbar> & {
  /** Scrollbar visibility, as on `ScrollArea.Root`. */
  type?: ScrollAreaType;
};

// Base UI has no `type` prop — map the Radix-style API to keepMounted + visibility.
const SCROLLBAR_TYPE = {
  always: { keepMounted: true, className: "opacity-100" },
  auto: { keepMounted: false, className: "opacity-100" },
  hover: {
    keepMounted: false,
    className:
      "pointer-events-none opacity-0 transition-opacity data-[hovering]:pointer-events-auto data-[hovering]:opacity-100 data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100 data-[scrolling]:duration-0",
  },
} satisfies Record<ScrollAreaType, { keepMounted: boolean; className: string }>;

function ScrollAreaRoot({
  className,
  children,
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaRootProps): ReactElement {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] transition-[color,box-shadow]",
          focusRing({ target: "self" }).root()
        )}>
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaBar orientation={orientation} type={type} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollAreaBar({
  className,
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaBarProps): ReactElement {
  const { keepMounted, className: visibilityClassName } = SCROLLBAR_TYPE[type];
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      className={cn(
        "flex touch-none p-px select-none",
        orientation === "vertical" && "w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        visibilityClassName,
        className
      )}
      {...props}
      orientation={orientation}
      keepMounted={keepMounted}>
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

ScrollAreaRoot.displayName = "ScrollArea.Root";
ScrollAreaBar.displayName = "ScrollArea.Bar";

export const ScrollArea = {
  Root: ScrollAreaRoot,
  Bar: ScrollAreaBar,
};
