/**
 * Each series' state at each slot, as CONTRACT section 8.6 and section 8.7 define them. Fuse
 * decides the state per series and per slot, because series publish on different clocks.
 */
import type { ChartScalar } from "../chart-types";
import { numberOf } from "./scalar";

/** A reading's quality once a value is present. A measured reading carries no attribute. */
export type ReadingQuality = "measured" | "estimated" | "corrected";

/** One series at one slot. */
export type Reading =
  | { readonly kind: "reading"; readonly value: number; readonly quality: ReadingQuality }
  | { readonly kind: "missing" }
  | { readonly kind: "pending" };

/** A data rule one cell broke, with the production fallback already applied. */
export type CellIssue = {
  readonly rule: "non-finite-value" | "value-out-of-range" | "quality-without-value" | "invalid-quality";
  /** The slot index. */
  readonly slot: number;
};

/** Values above this magnitude count as missing. 1e15 Wh is 1 PWh, and the d3 tick port stays exact there. */
const VALUE_LIMIT = 1e15;

/** What one cell holds before the span and `now` decide a slot with no reading. */
type Cell =
  | { readonly kind: "reading"; readonly value: number; readonly quality: ReadingQuality }
  | { readonly kind: "missing" }
  | { readonly kind: "none" };

/** Each slot's start and end in epoch milliseconds. */
export type SlotSpans = { readonly starts: readonly number[]; readonly ends: readonly number[] };

/** A series' readings and the cell issues that produced them. */
export type SeriesReadings = { readonly readings: readonly Reading[]; readonly issues: readonly CellIssue[] };

/** A series' cells at each slot. */
export type SeriesCells = {
  /** The value cell at each slot, undefined for a slot with no row. */
  readonly values: readonly ChartScalar[];
  /** The quality cell at each slot, undefined without a quality column or row. */
  readonly qualities: readonly ChartScalar[];
};

function readCell(cell: ChartScalar, quality: ChartScalar, slot: number, issues: CellIssue[]): Cell {
  const value = numberOf(cell);
  if (
    (value !== undefined && !Number.isFinite(value)) ||
    (value === undefined && cell !== null && cell !== undefined)
  ) {
    issues.push({ rule: "non-finite-value", slot });
    // The row exists, so a broken value is a missing reading, never a slot still to come.
    return { kind: "missing" };
  }
  if (quality === "missing") return { kind: "missing" };
  if (value === undefined) {
    if (quality === "estimated" || quality === "corrected") {
      issues.push({ rule: "quality-without-value", slot });
      return { kind: "missing" };
    }
    return { kind: "none" };
  }
  if (Math.abs(value) > VALUE_LIMIT) {
    issues.push({ rule: "value-out-of-range", slot });
    return { kind: "missing" };
  }
  // Normalise −0, because no attribute or label may carry a negative zero.
  const number = value === 0 ? 0 : value;
  if (quality === null || quality === undefined || quality === "measured") {
    return { kind: "reading", value: number, quality: "measured" };
  }
  if (quality === "estimated" || quality === "corrected") return { kind: "reading", value: number, quality };
  issues.push({ rule: "invalid-quality", slot });
  // An unknown code draws as estimated, which never presents a guess as a measurement.
  return { kind: "reading", value: number, quality: "estimated" };
}

/**
 * Decide one series' state at every slot.
 *
 * A slot with a number reads it with its quality. A `missing` quality is missing, whatever the
 * value. A slot with no reading is pending when it starts at or after `now` or holds it. Inside the
 * series' span, from its first reading to its last, it is missing. Outside the span it is missing
 * when `now` is set, because the slot has ended, and pending when it is not.
 *
 * @param cells - The series' value and quality cells per slot.
 * @param slots - Each slot's start and end in epoch milliseconds, for a time axis with `now`.
 * @param now - The current instant, or undefined.
 * @returns The readings per slot and the cell issues in slot order.
 */
export function readSeries(
  cells: SeriesCells,
  slots: SlotSpans | undefined,
  now: number | undefined
): SeriesReadings {
  const issues: CellIssue[] = [];
  const read = cells.values.map((value, slot) => readCell(value, cells.qualities[slot], slot, issues));
  const first = read.findIndex((cell) => cell.kind === "reading");
  let last = -1;
  read.forEach((cell, slot) => {
    if (cell.kind === "reading") last = slot;
  });
  const readings = read.map((cell, slot): Reading => {
    if (cell.kind !== "none") return cell;
    const end = slots?.ends[slot];
    if (now !== undefined && end !== undefined && end > now) return { kind: "pending" };
    // With no reading at all, first and last are both -1, so no slot lies between them.
    if (slot > first && slot < last) return { kind: "missing" };
    return now === undefined ? { kind: "pending" } : { kind: "missing" };
  });
  return { readings, issues };
}

/** Where a slot sits against `now`. */
export type SlotTime = "past" | "current" | "future";

/**
 * Classify a slot against `now`.
 *
 * @param start - The slot start.
 * @param end - The slot end.
 * @param now - The current instant.
 * @returns `past` when the slot ended at or before `now`, `current` when it holds `now`, else `future`.
 */
export function slotTime(start: number, end: number, now: number): SlotTime {
  if (end <= now) return "past";
  return start <= now ? "current" : "future";
}
