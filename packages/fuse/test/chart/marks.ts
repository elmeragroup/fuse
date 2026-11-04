/**
 * The DOM readers the chart browser suites share for marks and the tooltip popup. Bars and the
 * popup are aria-hidden plot output, so their slots are the only locators.
 */
import { userEvent } from "vitest/browser";

import { drawnRect } from "./bar-box";

/**
 * The bars a chart draws, in page order, of one series or of all.
 *
 * @param host - The rendered chart's host.
 * @param series - The series ordinal, or every series when omitted.
 * @returns The bar elements.
 */
export function bars(host: HTMLElement, series?: number): HTMLElement[] {
  const scope =
    series === undefined ? "" : `[data-slot="chart-bar-series"][data-series="${String(series)}"] `;
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [...host.querySelectorAll<HTMLElement>(`${scope}[data-slot="chart-bar"]`)];
}

/**
 * Each bar's drawn height, in page order.
 *
 * @param host - The rendered chart's host.
 * @returns The heights in pixels.
 */
export function barHeights(host: HTMLElement): number[] {
  return bars(host).map((bar) => drawnRect(bar).height);
}

/**
 * The first bar series layer's box, which covers the plot and which clip paths resolve against.
 *
 * @param host - The rendered chart's host.
 * @returns The layer's client box, or an empty box when no Bar draws.
 */
export function barLayerBox(host: HTMLElement): DOMRect {
  // DOM audit: the bar series layer covers the plot box.
  return host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
}

/**
 * Whether the tooltip popup shows: open, not fading out or closed. It portals out of the host, and
 * once it has opened it stays mounted, hidden while closed.
 *
 * @returns Whether it shows.
 */
export function popupOpen(): boolean {
  // DOM audit: the popup portals out of the host and carries its own slot.
  const popup = document.querySelector('[data-slot="chart-tooltip"]');
  return popup !== null && popup.hasAttribute("data-open") && !popup.hasAttribute("data-ending-style");
}

/**
 * Whether two boxes overlap by more than an edge.
 *
 * @param a - One box.
 * @param b - The other box.
 * @returns Whether they intersect.
 */
export function intersects(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Wait for the tooltip's glide from one slot to the next to land, so the popup shows its resting
 * place. A glide runs on the positioner, which portals out of the host.
 */
export async function glideLanded(): Promise<void> {
  // DOM audit: the popup portals out of the host, and its positioner carries the glide.
  const positioner = document.querySelector('[data-slot="chart-tooltip-positioner"]');
  await Promise.allSettled(positioner?.getAnimations().map((animation) => animation.finished) ?? []);
}

/**
 * The plot surface's client box.
 *
 * @param host - The rendered chart's host.
 * @returns The box, or an empty box with no plot.
 */
export function surfaceBox(host: HTMLElement): DOMRect {
  return host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
}

/**
 * The open tooltip popup. It portals out of the host, and a closed popup stays mounted, hidden.
 *
 * @returns The popup, or null while none is open.
 */
export function popup(): HTMLElement | null {
  // DOM audit: the popup is aria-hidden and portals out of the host, so its slot is the locator.
  return document.querySelector<HTMLElement>('[data-slot="chart-tooltip"][data-open]');
}

/**
 * The open popup's slot label.
 *
 * @returns The label's text, or null while no popup is open.
 */
export function label(): string | null {
  // DOM audit: the popup is aria-hidden, so its label's slot is the only locator.
  return popup()?.querySelector('[data-slot="chart-tooltip-label"]')?.textContent ?? null;
}

/**
 * The element at a point in client pixels and the point inside it, as `userEvent.hover` and
 * `userEvent.click` take them. The options skip Playwright's wait for that element to be the hit
 * target, because a popup that follows the slot may move between the hit check and the event.
 *
 * @param x - The client x.
 * @param y - The client y.
 * @returns The element and the event options.
 */
export function pointerTarget(
  x: number,
  y: number
): [Element, { readonly position: { readonly x: number; readonly y: number }; readonly force: true }] {
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof Element)) throw new Error(`nothing at ${String(x)}, ${String(y)}`);
  const box = target.getBoundingClientRect();
  return [target, { position: { x: x - box.left, y: y - box.top }, force: true }];
}

/**
 * Move the pointer to a point in client pixels, over the element at that point, as a hand does.
 *
 * @param x - The client x.
 * @param y - The client y.
 */
export async function pointerAt(x: number, y: number): Promise<void> {
  await userEvent.hover(...pointerTarget(x, y));
}
