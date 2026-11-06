import { expect } from "vitest";

import { roleNamed } from "./themed-browser-render";

/**
 * The carousel's viewport inside its region. It is a scroll container with no role, so no role
 * query reaches it; it is the region's one focusable live region, which no other part is.
 *
 * @param region - The carousel's region, found by its name.
 * @returns The viewport.
 */
export function carouselViewport(region: HTMLElement): HTMLElement {
  const viewport = region.querySelector<HTMLElement>("[tabindex='0'][aria-live]");
  if (viewport === null) {
    throw new Error("expected the carousel's focusable viewport");
  }
  return viewport;
}

/**
 * The buttons of the slide picker, in order.
 *
 * @param name - The picker group's name, the en-US default unless a suite renames it.
 * @returns Each indicator button.
 */
export function carouselIndicators(name = "Choose slide to display"): HTMLElement[] {
  return [...roleNamed("group", name).querySelectorAll<HTMLElement>("button")];
}

/**
 * Which indicator the APG grouped carousel marks current: the one `aria-disabled` picker button.
 *
 * @returns Its index, or -1 while none is.
 */
export function currentIndicator(): number {
  return carouselIndicators().findIndex((button) => button.getAttribute("aria-disabled") === "true");
}

/**
 * Wait until a horizontal viewport's scroll position comes to `left`, rounded to the pixel.
 *
 * @param viewport - The carousel's viewport.
 * @param left - The expected `scrollLeft`.
 */
export async function settledOn(viewport: HTMLElement, left: number): Promise<void> {
  await expect.poll(() => Math.round(viewport.scrollLeft), { timeout: 3000 }).toBe(left);
}
