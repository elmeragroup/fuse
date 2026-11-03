/**
 * The DOM readers the Panel browser suites share: each Panel's plot box, the bars and the line's
 * vertices as drawn, and the motion oracle's eased progress.
 */
import { barBox } from "./bar-box";
import type { BarBox } from "./bar-box";
import frames from "./motion-frames.json" with { type: "json" };

/**
 * A Panel's plot box, by Panel order.
 *
 * @param host - The rendered chart's host.
 * @param panel - The Panel's index.
 * @returns The plot's client box.
 */
export function plotOf(host: HTMLElement, panel: number): DOMRect {
  // DOM audit: each Panel's measured plot is the part under test.
  const plot = host.querySelectorAll('[data-slot="chart-panel"] > [data-slot="chart-plot"]')[panel];
  if (plot === undefined) throw new Error("no Panel plot");
  return plot.getBoundingClientRect();
}

/**
 * Each bar's box in pixels from the first Panel's plot.
 *
 * @param host - The rendered chart's host.
 * @returns The boxes in page order.
 */
export function barBoxes(host: HTMLElement): BarBox[] {
  const plot = plotOf(host, 0);
  // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar) => barBox(bar, plot));
}

/**
 * Each bar's height as drawn, from its rect, in page order.
 *
 * @param host - The rendered chart's host.
 * @returns The heights in CSS pixels.
 */
export function barHeights(host: HTMLElement): number[] {
  // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
  return [...host.querySelectorAll('[data-slot="chart-bar"]')].map(
    (bar) => bar.getBoundingClientRect().height
  );
}

/**
 * The vertices of the first line's resting path, outside any outgoing copy.
 *
 * @param host - The rendered chart's host.
 * @returns The path's numbers in pairs.
 */
export function lineVertices(host: HTMLElement): (readonly [number, number])[] {
  // DOM audit: the line is aria-hidden plot output, so its slot is the only locator.
  const d =
    host
      .querySelector('[data-slot="chart-line"][data-part="solid"]:not([data-outgoing] *)')
      ?.getAttribute("d") ?? "";
  const numbers = d.match(/-?\d+(?:\.\d+)?/gu)?.map(Number) ?? [];
  return Array.from(
    { length: numbers.length / 2 },
    (_, index) => [numbers[index * 2] ?? 0, numbers[index * 2 + 1] ?? 0] as const
  );
}

/**
 * Whether a distance from the plot's origin is a whole number of device pixels.
 *
 * @param at - The distance in CSS pixels.
 * @returns Whether it lands on the device grid.
 */
export function onGrid(at: number): boolean {
  return Math.abs(at * devicePixelRatio - Math.round(at * devicePixelRatio)) < 0.01;
}

/**
 * An element's client box, failing when the element is absent.
 *
 * @param element - The element.
 * @returns Its client box.
 */
export function rectOf(element: Element | null | undefined): DOMRect {
  if (element === null || element === undefined) throw new Error("no element");
  return element.getBoundingClientRect();
}

/**
 * The motion oracle's eased progress at a time, from its hand-written line positions.
 *
 * @param ms - Milliseconds into the 480 ms tween.
 * @returns The progress from 0 to 1.
 */
export function easedAt(ms: 120 | 240 | 360): number {
  const { from, to, at } = frames.references.line;
  return (at[ms] - from) / (to - from);
}

/** Wait for the browser's next frame. */
export async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}
