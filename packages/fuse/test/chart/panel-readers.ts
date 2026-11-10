/** The DOM readers the Panel browser suites share: each Panel's plot box and the bars as drawn. */

/**
 * A Panel's plot box, by Panel order.
 *
 * @param host - The rendered chart's host.
 * @param panel - The Panel's index.
 * @returns The plot's client box.
 */
export function plotOf(host: HTMLElement, panel: number): DOMRect {
  // Each Panel's measured plot is the part under test.
  const plot = host.querySelectorAll('[data-slot="chart-panel"] > [data-slot="chart-plot"]')[panel];
  if (plot === undefined) throw new Error("no Panel plot");
  return plot.getBoundingClientRect();
}

/**
 * Each bar's height as drawn, from its rect, in page order.
 *
 * @param host - The rendered chart's host.
 * @returns The heights in CSS pixels.
 */
export function barHeights(host: HTMLElement): number[] {
  // Bars are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-bar"]')].map(
    (bar) => bar.getBoundingClientRect().height
  );
}

/** Wait for the browser's next frame. */
export async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
