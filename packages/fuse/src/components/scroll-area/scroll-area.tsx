"use client";

import type { ComponentProps, ReactElement } from "react";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { mergeClassName } from "../../styles/merge-class-name";
import { overlayFocusRingClass, overlayFocusRingControlClass } from "../../styles/utils";
import { scrollbarTypeVariants } from "./scroll-area-variants";

type ScrollAreaType = NonNullable<VariantProps<typeof scrollbarTypeVariants>["type"]>;

type ScrollAreaRootProps = ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  /**
   * Which single scrollbar `Root` renders, and so which axis the content scrolls on. A vertical
   * area holds its content to the viewport's width, so `truncate` text ellipsizes at the edge. A
   * horizontal area lets its content grow to its widest line and scroll. For two-axis scrolling,
   * compose Base UI's `ScrollArea` root, content and corner with a `ScrollArea.Viewport` and two
   * `ScrollArea.Bar`s, one per orientation.
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
type ScrollAreaViewportProps = ComponentProps<typeof ScrollAreaPrimitive.Viewport> & {
  /**
   * Extra classes, merged after the viewport's own. Size the viewport to the root. Under a root
   * with a definite height, use `size-full`. Under a root capped by `max-height`, `size-full`
   * leaves the viewport at its content's height, so the root clips the content and Tab skips the
   * viewport. Make that root a flex column and give the viewport `min-h-0 flex-1`, as
   * `ScrollArea.Root` does.
   */
  className?: ComponentProps<typeof ScrollAreaPrimitive.Viewport>["className"];
  /**
   * Base UI's `ScrollArea.Content` around the area's content. Render the viewport as a direct child
   * of Base UI's `ScrollArea.Root`, which positions itself, so the focus outline follows the root's
   * edge and corners. A positioned element between the two takes the outline on its own box instead.
   * A focused viewport paints over its earlier siblings, so render the `ScrollArea.Bar`s and Base
   * UI's `ScrollArea.Corner` after it. A visible scrollbar thumb then covers the outline where the
   * thumb sits.
   */
  children?: ComponentProps<typeof ScrollAreaPrimitive.Viewport>["children"];
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
      <ViewportElement className="min-h-0 flex-1">
        <ScrollAreaPrimitive.Content
          data-slot="scroll-area-content"
          // Base UI's inline `min-width: fit-content` grows the content to its widest line so it can
          // scroll sideways, which also keeps a `truncate` child from narrowing. Only a horizontal
          // area scrolls sideways, so a vertical one drops that floor and its content fills the
          // viewport. The important modifier outranks the inline style.
          className={cn(orientation === "vertical" && "min-w-0!")}>
          {children}
        </ScrollAreaPrimitive.Content>
      </ViewportElement>
      <ScrollAreaBar orientation={orientation} type={type} />
      <ScrollAreaPrimitive.Corner />
      {/* The root clips, so the viewport's focus outline draws on this sibling instead. It comes last
          so it paints above the positioned scrollbar and corner. */}
      <FocusIndicator />
    </ScrollAreaPrimitive.Root>
  );
}

/**
 * The viewport that `Root`, `Viewport` and `Attachment.Group` share: Base UI's viewport with the
 * overlay ring's control classes. It is package-private. Render `FocusIndicator` as a later sibling.
 *
 * @param props - Base UI's viewport props. A `data-slot` replaces `scroll-area-viewport`.
 * @returns The rendered viewport.
 */
export function ViewportElement({
  className,
  ...props
}: ComponentProps<typeof ScrollAreaPrimitive.Viewport>): ReactElement {
  return (
    <ScrollAreaPrimitive.Viewport
      data-slot="scroll-area-viewport"
      className={mergeClassName(className, "rounded-[inherit]", overlayFocusRingControlClass)}
      {...props}
    />
  );
}

/**
 * The empty sibling that draws a `ViewportElement`'s focus outline; see `focusRing`'s `overlay`
 * target. It is package-private.
 *
 * @param props - A `data-slot` that replaces `scroll-area-focus-indicator`.
 * @returns The rendered indicator.
 */
export function FocusIndicator(props: { readonly "data-slot"?: string }): ReactElement {
  return (
    <span aria-hidden data-slot="scroll-area-focus-indicator" className={overlayFocusRingClass} {...props} />
  );
}

/**
 * The scrolling viewport with its keyboard focus outline, for an area composed from Base UI's
 * `ScrollArea` parts. Base UI's viewport takes keyboard focus while its content overflows, and
 * this part draws the same outline as `ScrollArea.Root` just inside the root's edge.
 *
 * @param props - Base UI's viewport props.
 * @returns The rendered viewport, followed by its focus indicator.
 */
export function ScrollAreaViewport(props: ScrollAreaViewportProps): ReactElement {
  return (
    <>
      <ViewportElement {...props} />
      {/* The indicator stays at `z-index: auto`, as `Root`'s does, so a later positioned element of
          the host still covers it. The composition's later scrollbars and corner paint over it too,
          which keeps their thumbs visible and under the pointer while the viewport is focused. */}
      <FocusIndicator />
    </>
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
        className="relative flex-1 rounded-full mark-fill-border"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

ScrollAreaRoot.displayName = "ScrollArea.Root";
ScrollAreaViewport.displayName = "ScrollArea.Viewport";
ScrollAreaBar.displayName = "ScrollArea.Bar";
