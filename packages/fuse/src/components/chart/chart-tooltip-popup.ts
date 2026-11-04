"use client";

/**
 * The chart tooltip popup's look and its overflow watch, which every chart family's tooltip shares.
 * It reads no Root context.
 */
import { tv } from "../../styles/tv";

/**
 * The popup's corner and padding, and its fill per variant. Frosted glass lets the plot show through a translucent popover
 * fill and blurs it. It sits on the utilities layer with the overlay fill it replaces, so the
 * class merge drops the opaque fill.
 */
export const tooltipPopup = tv({
  // DESIGN-NOTES "Tooltips" gives the chart popup an 8 px radius and 8 px of block padding. The
  // popup is never taller than the room Base UI measures on its side, and scrolls past it.
  base: "max-h-[calc(100dvh-16px)] overflow-y-auto overscroll-contain rounded-lg py-2 [--shell-inner:max(0px,--theme(--radius-lg)-var(--surface-pad-md))] data-[input=touch]:not-data-scrolls:pointer-events-none",
  variants: {
    variant: {
      default: "",
      frosted: "supports-backdrop-filter:backdrop-blur-md bg-popover/70",
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
