/**
 * The DOM readers the chart browser suites share for marks and the tooltip popup. Bars and the
 * popup are aria-hidden plot output, so their slots are the only locators.
 */

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
 * Whether the tooltip popup shows: mounted and not fading out. It portals out of the host.
 *
 * @returns Whether it shows.
 */
export function popupOpen(): boolean {
  // DOM audit: the popup portals out of the host and carries its own slot.
  const popup = document.querySelector('[data-slot="chart-tooltip"]');
  return popup !== null && !popup.hasAttribute("data-ending-style");
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
