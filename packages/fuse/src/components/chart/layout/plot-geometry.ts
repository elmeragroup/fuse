/**
 * Positions inside the plot box, as fractions that CSS turns into percentages. The plot draws in
 * its own box, so the server writes final positions with no measured width.
 */
import { linearScale, scaleValue } from "./linear-scale";
import type { SlotWindow } from "./slot-window";

/**
 * A slot's centre along the x axis, as a fraction of the plot width. Band slots centre in equal
 * cells, and point slots run from the first edge to the last.
 *
 * @param window - The effective window.
 * @param slot - A slot inside the window.
 * @param xScale - The Root's x scale.
 * @returns The fraction from 0 to 1.
 */
export function slotCentre(window: SlotWindow, slot: number, xScale: "band" | "point"): number {
  const count = window.last - window.first + 1;
  const offset = slot - window.first;
  if (xScale === "band") return (offset + 0.5) / count;
  return count === 1 ? 0.5 : offset / (count - 1);
}

/**
 * A value's distance from the plot top, in percent, under a value domain.
 *
 * @param domain - The layout's value domain, lower bound first.
 * @param value - The value.
 * @returns 0 at the domain's top and 100 at its bottom.
 */
export function valueTop(domain: readonly [number, number], value: number): number {
  return scaleValue(linearScale(domain, [100, 0]), value);
}
