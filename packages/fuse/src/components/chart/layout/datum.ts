/**
 * The slots a datum selector picks, after CONTRACT section 8.10. Keywords compare what the part
 * draws inside the effective window, ties select every tied slot, and an x value outside the
 * domain selects nothing.
 */
import type { SlotWindow } from "./slot-window";

/** The keyword half of a datum selector. */
export type DatumKeyword = "first" | "last" | "min" | "max" | "now";

/** What a selector reads. */
export type DatumInput = {
  /** The drawn value per domain slot, null where the part draws nothing. */
  readonly values: readonly (number | null)[];
  readonly window: SlotWindow;
  /** The slot that contains Root's `now`, or -1. */
  readonly nowSlot: number;
};

/**
 * The slots a keyword picks.
 *
 * @param keyword - The keyword.
 * @param input - The drawn values, the window and the now slot.
 * @returns The picked slots in x order.
 */
export function keywordSlots(keyword: DatumKeyword, input: DatumInput): number[] {
  const { values, window, nowSlot } = input;
  const drawn: number[] = [];
  for (let slot = window.first; slot <= window.last; slot += 1) {
    if (values[slot] !== null && values[slot] !== undefined) drawn.push(slot);
  }
  switch (keyword) {
    case "now":
      return nowSlot >= window.first && nowSlot <= window.last ? [nowSlot] : [];
    case "first":
      return drawn.slice(0, 1);
    case "last":
      return drawn.slice(-1);
    case "min":
    case "max": {
      const sign = keyword === "max" ? 1 : -1;
      let best = Number.NEGATIVE_INFINITY;
      for (const slot of drawn) best = Math.max(best, sign * (values[slot] ?? 0));
      return drawn.filter((slot) => sign * (values[slot] ?? 0) === best);
    }
  }
}

/**
 * The slots a list of x values picks, inside the window.
 *
 * @param slots - The slot each x value names, -1 for one outside the domain.
 * @param window - The effective window.
 * @returns The distinct picked slots in x order.
 */
export function listedSlots(slots: readonly number[], window: SlotWindow): number[] {
  const inside = slots.filter((slot) => slot >= window.first && slot <= window.last);
  return [...new Set(inside)].sort((a, b) => a - b);
}
