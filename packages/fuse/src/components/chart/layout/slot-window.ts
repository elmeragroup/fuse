/**
 * The effective x window, as CONTRACT section 8.12 and section 9.4 define it. `xRange` names its
 * first and last slot, and the window is the domain's slots between them. The listbox walks the
 * window, its y domains read the window's rows, and an active slot keeps its x across new data.
 */
import type { ChartScalar } from "../chart-types";
import { instantOf, slotCount, slotOf } from "./x-domain";
import type { XDomain } from "./x-domain";

/** A run of slots, both ends inclusive. */
export type SlotWindow = { readonly first: number; readonly last: number };

/**
 * The window a range selects. A time axis keeps every slot that overlaps the span from the first
 * value's slot to the last value's slot, so an instant a millisecond late still finds its slot. A
 * category axis needs both values to exist. When no slot remains, or no range is set, the window is
 * the whole domain.
 *
 * @param domain - The x domain.
 * @param range - The first and last x values, or undefined.
 * @returns The window, or null for an empty domain.
 */
export function effectiveWindow(
  domain: XDomain,
  range: readonly [ChartScalar, ChartScalar] | undefined
): SlotWindow | null {
  const count = slotCount(domain);
  if (count === 0) return null;
  const whole = { first: 0, last: count - 1 };
  if (range === undefined) return whole;
  if (domain.kind === "category") {
    const a = slotOf(domain, range[0]);
    const b = slotOf(domain, range[1]);
    if (a === -1 || b === -1) return whole;
    return { first: Math.min(a, b), last: Math.max(a, b) };
  }
  // An invalid instant makes both bounds NaN, so no slot overlaps and the window is whole.
  const from = Math.min(instantOf(range[0]), instantOf(range[1]));
  const to = Math.max(instantOf(range[0]), instantOf(range[1]));
  const inside = domain.starts.flatMap((start, slot) =>
    (domain.ends[slot] ?? start) > from && start <= to ? [slot] : []
  );
  const [first] = inside;
  return first === undefined ? whole : { first, last: inside.at(-1) ?? first };
}

/** The listbox keys that move the active slot. */
export type SlotStep = "next" | "previous" | "page-next" | "page-previous" | "first" | "last";

/**
 * Move the active slot inside the window. A page is `max(1, round(count / 10))` slots, where count
 * is the window's slot count, so 2 of 24 and 37 of 365. Moves stop at the window's ends.
 *
 * @param window - The effective window.
 * @param slot - The active slot.
 * @param step - The key's move.
 * @returns The new active slot.
 */
export function stepSlot(window: SlotWindow, slot: number, step: SlotStep): number {
  const page = Math.max(1, Math.round((window.last - window.first + 1) / 10));
  const clamp = (target: number): number => Math.max(window.first, Math.min(window.last, target));
  switch (step) {
    case "next":
      return clamp(slot + 1);
    case "previous":
      return clamp(slot - 1);
    case "page-next":
      return clamp(slot + page);
    case "page-previous":
      return clamp(slot - page);
    case "first":
      return window.first;
    case "last":
      return window.last;
  }
}

/**
 * The active slot after new data. The slot keeps its x, and when that x leaves the window, the
 * window's first slot becomes active.
 *
 * @param domain - The new domain.
 * @param window - The new effective window.
 * @param x - The active slot's x before the update, as `slotX` reported it.
 * @returns The new active slot.
 */
export function keepSlot(domain: XDomain, window: SlotWindow, x: ChartScalar): number {
  const slot = slotOf(domain, x);
  return slot >= window.first && slot <= window.last ? slot : window.first;
}
