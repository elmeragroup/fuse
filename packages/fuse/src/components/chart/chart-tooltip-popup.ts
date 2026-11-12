"use client";

/**
 * What every chart family's tooltip shares around its own anchor: the positioner's placement rules,
 * the dismissal filter, the popup's look and its overflow watch. It reads no Root context.
 */
import { cn } from "../../styles/cn";
import { tooltipShellClass } from "../../styles/inner-corner/tooltip";
import { tv } from "../../styles/tv";
import {
  overlayPopupMotionClass,
  overlayPopupSurfaceClass,
  overlayPositionerClass,
} from "../overlay/overlay-classes";
import { TOOLTIP_EDGE } from "./layout/tooltip-place";
import type { PlaceSize } from "./layout/tooltip-place";

/**
 * The positioner props every chart tooltip starts from. The popup prefers the top and flips to the
 * opposite side, or shifts along its side, to stay in the viewport. When neither the preferred side
 * nor its opposite holds its content, as at 400 % zoom, it sits beside its anchor, and when no side
 * does, it overlays the plot, per CONTRACT section 9.5. Base UI's flip adds 1 px to the collision
 * padding, and 1 px more on the side opposite the preferred top, so these paddings make every flip
 * test read `TOOLTIP_EDGE`, the same 8 px inset the overlay offset tests.
 */
export const TOOLTIP_POSITIONER = {
  side: "top",
  align: "center",
  collisionAvoidance: { side: "flip", align: "shift", fallbackAxisSide: "end" },
  collisionPadding: {
    top: TOOLTIP_EDGE - 1,
    right: TOOLTIP_EDGE - 1,
    bottom: TOOLTIP_EDGE - 2,
    left: TOOLTIP_EDGE - 1,
  },
  "data-slot": "chart-tooltip-positioner",
  className: overlayPositionerClass,
} as const;

/** The dismissal Base UI reports when the tooltip would close: its reason and the event behind it. */
type TooltipDismissal = { readonly reason: string; readonly event: Event };

/**
 * Whether a dismissal Base UI reports belongs to the chart instead. A press on the chart itself
 * picks or pins a datum, so it never closes the tooltip from outside. Every other dismissal, such as
 * a press outside the chart or Escape with focus elsewhere, takes the store's one dismissal.
 *
 * @param details - Base UI's dismissal details.
 * @param chart - The chart Root's element, or null before it mounts.
 * @returns True when the chart handles the press itself.
 */
export function chartTakesPress(details: TooltipDismissal, chart: HTMLElement | null): boolean {
  const target = details.event.target;
  return details.reason === "outside-press" && target instanceof Node && chart?.contains(target) === true;
}

/**
 * The popup's classes: Fuse's overlay surface, shell and motion, then the chart popup's own look in
 * the variant, then the consumer's.
 *
 * @param variant - The popup's surface.
 * @param className - The consumer's classes.
 * @returns The class list.
 */
export function tooltipPopupClass(variant: "default" | "frosted", className: string | undefined): string {
  return cn(
    overlayPopupSurfaceClass,
    tooltipShellClass,
    overlayPopupMotionClass,
    tooltipPopup({ variant }),
    className
  );
}

/**
 * The viewport's size, which every side test and the popup's place along its side keep inside.
 *
 * @returns The layout viewport's width and height in CSS pixels.
 */
export function viewportSize(): PlaceSize {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
}

/**
 * The popup's corner and padding, and its fill per variant. Frosted glass lets the plot show through a translucent popover
 * fill and blurs it. It sits on the utilities layer with the overlay fill it replaces, so the
 * class merge drops the opaque fill. A translucent fill keeps the surface beneath it, so frosted
 * glass also drops the popover `--surface` the overlay fill states.
 */
const tooltipPopup = tv({
  // DESIGN-NOTES "Tooltips" gives the chart popup an 8 px radius and 8 px of block padding. The
  // popup is never taller than the room Base UI measures on its side, and scrolls past it.
  base: "max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain rounded-lg py-2 [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))] data-[input=touch]:not-data-scrolls:pointer-events-none",
  variants: {
    variant: {
      default: "",
      frosted:
        "supports-backdrop-filter:backdrop-blur-md bg-popover/70 [--surface-muted-foreground:inherit] [--surface:inherit]",
    },
  },
});

/**
 * Mark the popup with `data-scrolls` while its content overflows it. Under touch the popup lets
 * taps and scrubs through to the plot, except while it scrolls, when it takes the finger so a drag
 * scrolls it. Content that grows inside a popup at its height cap, or at a height a consumer set,
 * leaves the popup's size alone, so the observer follows each of the popup's children as well.
 */
export function watchOverflow(popup: HTMLDivElement | null): (() => void) | undefined {
  if (popup === null) return undefined;
  const mark = () => popup.toggleAttribute("data-scrolls", popup.scrollHeight > popup.clientHeight);
  const sizes = new ResizeObserver(mark);
  sizes.observe(popup);
  for (const child of popup.children) sizes.observe(child);
  const children = new MutationObserver((records) => {
    for (const { addedNodes, removedNodes } of records) {
      for (const node of removedNodes) if (node instanceof Element) sizes.unobserve(node);
      for (const node of addedNodes) if (node instanceof Element) sizes.observe(node);
    }
    mark();
  });
  children.observe(popup, { childList: true });
  return () => {
    sizes.disconnect();
    children.disconnect();
  };
}
