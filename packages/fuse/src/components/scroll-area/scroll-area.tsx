"use client";

import type { ComponentProps, ReactElement } from "react";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { VariantProps } from "tailwind-variants";

import { handoff } from "../../internal/part-handoff";
import { cn } from "../../styles/cn";
import { selfFocusRingClass } from "../../styles/utils";
import { scrollbarTypeVariants } from "./scroll-area-variants";

type ScrollAreaType = NonNullable<VariantProps<typeof scrollbarTypeVariants>["type"]>;

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

// Base UI has no `type` prop — map the Radix-style API to keepMounted; visibility is the recipe.
const SCROLLBAR_KEEP_MOUNTED = {
  always: true,
  auto: false,
  hover: false,
} as const satisfies Record<ScrollAreaType, boolean>;

export function ScrollAreaRoot({
  children,
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaRootProps): ReactElement {
  return (
    <ScrollAreaPrimitive.Root
      {...handoff(props, {
        defaults: { "data-slot": "scroll-area" },
        classes: ["relative overflow-hidden"],
      })}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn("size-full rounded-[inherit] transition-[color,box-shadow]", selfFocusRingClass)}>
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaBar orientation={orientation} type={type} />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollAreaBar({
  orientation = "vertical",
  type = "hover",
  ...props
}: ScrollAreaBarProps): ReactElement {
  return (
    <ScrollAreaPrimitive.Scrollbar
      {...handoff(props, {
        defaults: { "data-slot": "scroll-area-scrollbar" },
        classes: [
          "flex touch-none p-px select-none",
          orientation === "vertical" && "w-2.5 border-l border-l-transparent",
          orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
          scrollbarTypeVariants({ type }),
        ],
      })}
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
