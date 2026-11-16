/**
 * Positions inside the plot box, as fractions that CSS turns into percentages. The plot draws in
 * its own box, so the server writes final positions with no measured width.
 */
import { linearScale, scaleValue } from "./linear-scale";
import { centerShare } from "./slot-scale";
import type { SlotScale } from "./slot-scale";
import type { SlotWindow } from "./slot-window";

/**
 * A slot's center along the x axis, as a fraction of the plot width. Band slots center in equal
 * cells, point slots run from the first edge to the last, and linear slots sit at their values.
 *
 * @param window - The effective window.
 * @param slot - A slot inside the window.
 * @param xScale - The Root's x scale.
 * @returns The fraction from 0 to 1.
 */
export function slotCenter(window: SlotWindow, slot: number, xScale: SlotScale): number {
  return centerShare(xScale, window.last - window.first + 1, slot - window.first);
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
