"use client";

import type { ComponentProps, ReactElement } from "react";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { selfFocusRingClass } from "../../styles/utils";
import { scrollbarTypeVariants } from "./scroll-area-variants";

type ScrollAreaType = NonNullable<VariantProps<typeof scrollbarTypeVariants>["type"]>;

type ScrollAreaRootProps = ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /**
   * Which single scrollbar `Root` renders, and so which axis the content scrolls on. A vertical
   * area holds its content to the viewport's width, so `truncate` text ellipsizes at the edge. A
   * horizontal area lets its content grow to its widest line and scroll. For two-axis scrolling,
   * compose Base UI's `ScrollArea` parts and mount two `ScrollArea.Bar`s, one per orientation.
   */
  orientation?: "vertical" | "horizontal";
  /**
   * When the scrollbar shows. `hover` shows it on hover or scroll, `always` keeps it mounted and
   * visible, and `auto` mounts it only while the content overflows.
   */
  type?: ScrollAreaType;
  /**
   * Extra classes, merged after the area's own. Give the area a height, such as `h-72`, or a max
   * height, such as `max-h-72`. Under a max height, short content keeps the area at its content
   * height, and longer content scrolls once it reaches the cap.
   */
  className?: ComponentProps<typeof ScrollAreaPrimitive.Root>["className"];
};
type ScrollAreaBarProps = ComponentProps<typeof ScrollAreaPrimitive.Scrollbar> & {
  /** When the scrollbar shows, as on `ScrollArea.Root`. */
  type?: ScrollAreaType;
};
// Base UI has no `type` prop. `type` maps to `keepMounted` here, and the recipe sets visibility.
const SCROLLBAR_KEEP_MOUNTED = {
  always: true,
  auto: false,
  hover: false,
} as const satisfies Record<ScrollAreaType, boolean>;

/**
 * A scrolling area with one custom scrollbar over native scrolling.
 *
 * @param props - The orientation, the scrollbar type and Base UI's root props.
 * @returns The rendered area with its viewport, content and scrollbar.
 */
export function ScrollAreaRoot({
  className,
  children,
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaRootProps): ReactElement {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={mergeClassName(className, "relative flex flex-col overflow-hidden")}
      {...props}>
      {/* A flex column hands the viewport the root's resolved height, so a max height caps and scrolls
          like a fixed one; `size-full` would resolve to auto under a max height and the root would clip. */}
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn("min-h-0 flex-1 rounded-[inherit] transition-[color,box-shadow]", selfFocusRingClass)}>
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          // Base UI's inline `min-width: fit-content` grows the content to its widest line so it can
          // scroll sideways, which also keeps a `truncate` child from narrowing. Only a horizontal
          // area scrolls sideways, so a vertical one drops that floor (the important modifier
          // outranks the inline style) and its content fills the viewport.
          className={cn(orientation === "vertical" && "min-w-0!")}>
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaBar orientation={orientation} type={type} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

/**
 * One custom scrollbar, for an area composed from Base UI's `ScrollArea` parts.
 *
 * @param props - The scrollbar type and Base UI's scrollbar props.
 * @returns The rendered scrollbar and its thumb.
 */
export function ScrollAreaBar({
  className,
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaBarProps): ReactElement {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      className={mergeClassName(
        className,
        "flex touch-none p-px select-none",
        orientation === "vertical" && "w-2.5 border-l border-l-transparent",
        orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
        scrollbarTypeVariants({ type })
      )}
      {...props}
      orientation={orientation}
      keepMounted={SCROLLBAR_KEEP_MOUNTED[type]}>
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

ScrollAreaRoot.displayName = "ScrollArea.Root";
ScrollAreaBar.displayName = "ScrollArea.Bar";
