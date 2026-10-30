/**
 * Per-series resolution, as CONTRACT section 8.8 defines it. Root's `interval` is the x grid, and
 * a series may take a coarser interval that nests in it. A coarse slot covers every Root slot whose
 * start lies inside it, counted by instants in the zone, so an hour covers 4 quarters on every day,
 * DST days included, and a day covers 23, 24 or 25 hours. Fuse never aggregates: a coarse series
 * reads one value per coarse slot, from the row at the slot's start.
 */
import { nextSlotStart, slotStart } from "../format/time-format";
import type { Interval } from "../format/time-format";
import type { SeriesModel } from "./cartesian-model";

/** Every interval from finest to coarsest. */
const ORDER: readonly Interval[] = [
  "second",
  "minute",
  "quarter-hour",
  "hour",
  "day",
  "week",
  "month",
  "year",
];

/**
 * Whether a series interval nests in Root's. An interval nests in itself and in every coarser one,
 * except that an ISO week crosses month and year boundaries, so it nests in no coarser interval.
 *
 * @param root - Root's interval, the finest in the chart.
 * @param series - A series' interval.
 * @returns Whether every Root slot lies inside one of the series' slots.
 */
export function intervalNests(root: Interval, series: Interval): boolean {
  if (root === series) return true;
  return root !== "week" && ORDER.indexOf(root) < ORDER.indexOf(series);
}

/**
 * Where a coarse series' slots lie on Root's grid. A coarse slot's Root slots are the domain's cells
 * it covers, which draw its bar and span its Table cell. Its own start and end are the interval's,
 * which decide its reading's state and its grid, and a domain can start or end inside it.
 */
export type CoarseSlots = {
  readonly interval: Interval;
  /** The first Root slot of the coarse slot that holds each Root slot, by Root slot. */
  readonly first: readonly number[];
  /** The last Root slot of the coarse slot that holds each Root slot, by Root slot. */
  readonly last: readonly number[];
  /** The start instant of the coarse slot that holds each Root slot, by Root slot. */
  readonly start: readonly number[];
  /** The end instant of the coarse slot that holds each Root slot, the next one's start. */
  readonly end: readonly number[];
};

/**
 * Group Root's slots into a coarse interval's slots by the coarse slot each Root slot starts in.
 *
 * @param starts - Each Root slot's start instant, ascending.
 * @param interval - The series' coarse interval.
 * @param timeZone - The IANA zone of the data's market.
 * @returns Each Root slot's coarse slot: its first and last Root slot, and its own start and end.
 */
export function coarseSlots(starts: readonly number[], interval: Interval, timeZone: string): CoarseSlots {
  const owner = starts.map((start) => slotStart(start, interval, timeZone));
  const ends = new Map<number, number>();
  const end = owner.map((start) => {
    const known = ends.get(start) ?? nextSlotStart(start, interval, timeZone);
    ends.set(start, known);
    return known;
  });
  const first: number[] = [];
  const last: number[] = Array.from({ length: starts.length }, () => 0);
  owner.forEach((start, slot) => {
    first.push(slot > 0 && owner[slot - 1] === start ? (first[slot - 1] ?? slot) : slot);
  });
  for (let slot = starts.length - 1; slot >= 0; slot -= 1) {
    last[slot] =
      slot + 1 < starts.length && first[slot + 1] === first[slot] ? (last[slot + 1] ?? slot) : slot;
  }
  return { interval, first, last, start: owner, end };
}

/**
 * The row spans of a coarse series' Table cells. The Table lists some of Root's slots as rows, and
 * a coarse cell covers every listed row of its slot, so each coarse value appears once.
 *
 * @param rows - The Root slots the Table lists, ascending.
 * @param coarse - The series' coarse slots.
 * @returns Each listed row's span: the number of listed rows its cell covers at the first listed
 *   row of its coarse slot, and 0 at every later row, which renders no cell.
 */
export function rowSpans(rows: readonly number[], coarse: CoarseSlots): number[] {
  const spans = rows.map(() => 0);
  let open = -1;
  rows.forEach((slot, index) => {
    const previous = rows[index - 1];
    if (open === -1 || previous === undefined || coarse.first[slot] !== coarse.first[previous]) open = index;
    spans[open] = (spans[open] ?? 0) + 1;
  });
  return spans;
}

/**
 * The series' own slot that holds a Root slot, as its first and last Root slot: the slot itself, or
 * a coarse series' slot.
 *
 * @param series - The series.
 * @param slot - A Root slot.
 * @returns The first and last Root slot of the series' slot.
 */
export function ownSlot(series: SeriesModel, slot: number): readonly [number, number] {
  const { coarse } = series;
  return coarse === undefined ? [slot, slot] : [coarse.first[slot] ?? slot, coarse.last[slot] ?? slot];
}

/** Where an own slot lies in the window: its first Root slot's place and its count of Root slots. */
export type OwnSpan = { readonly position: number; readonly span: number };

/**
 * Where the series' own slot that holds a Root slot lies in the window: its first Root slot's
 * place, clipped to the window, and how many of the window's Root slots it covers.
 *
 * @param series - The series.
 * @param window - The effective window.
 * @param slot - A Root slot inside the window.
 * @returns The place and the count.
 */
export function ownSpan(
  series: SeriesModel,
  window: { readonly first: number; readonly last: number },
  slot: number
): OwnSpan {
  const [first, last] = ownSlot(series, slot);
  const start = Math.max(first, window.first);
  return { position: start - window.first, span: Math.min(last, window.last) - start + 1 };
}

/**
 * The place in the window, in slots, of the middle of the series' own slot that holds a Root slot:
 * the slot's own place, or the middle of the coarse slot's cells inside the window, where its
 * line's vertex and its bar's middle lie.
 *
 * @param series - The series.
 * @param window - The effective window.
 * @param slot - A Root slot.
 * @returns The middle's place, a fraction for a coarse slot of an even count.
 */
export function ownCentre(
  series: SeriesModel,
  window: { readonly first: number; readonly last: number },
  slot: number
): number {
  const { position, span } = ownSpan(series, window, slot);
  return position + (span - 1) / 2;
}

/**
 * The start and end instants of the series' own slot that holds a Root slot: the Root slot's own,
 * or the coarse interval's, which can reach past the domain's first or last Root slot.
 *
 * @param series - The series.
 * @param slots - Each Root slot's start and end instant.
 * @param slot - A Root slot.
 * @returns The own slot's start and end in epoch milliseconds.
 */
export function ownBounds(
  series: SeriesModel,
  slots: { readonly starts: readonly number[]; readonly ends: readonly number[] },
  slot: number
): readonly [number, number] {
  const { coarse } = series;
  return coarse === undefined
    ? [slots.starts[slot] ?? 0, slots.ends[slot] ?? 0]
    : [coarse.start[slot] ?? 0, coarse.end[slot] ?? 0];
}

/**
 * The first Root slot of each own slot of the series that the window holds, in order: every Root
 * slot, or one per coarse slot, whose first Root slot can lie before the window's first.
 *
 * @param series - The series.
 * @param window - The effective window.
 * @returns The own slots' first Root slots, ascending.
 */
export function ownWindowFirsts(
  series: SeriesModel,
  window: { readonly first: number; readonly last: number }
): number[] {
  const firsts: number[] = [];
  for (let slot = window.first; slot <= window.last; slot = ownSlot(series, slot)[1] + 1) {
    firsts.push(ownSlot(series, slot)[0]);
  }
  return firsts;
}

/**
 * One Root slot per own slot of the series that the window holds, the first of each inside the
 * window: every Root slot, or one per coarse slot. A coarse series holds its slot's reading at each
 * Root slot the slot covers, so a total, a count or a share over the window visits these alone.
 *
 * @param series - The series.
 * @param window - The effective window.
 * @returns The Root slots, ascending.
 */
export function ownWindowSlots(
  series: SeriesModel,
  window: { readonly first: number; readonly last: number }
): number[] {
  return ownWindowFirsts(series, window).map((first) => Math.max(first, window.first));
}

/**
 * The first Root slot of each own slot that some Root slots fall in, once each, in order: the slots
 * themselves, or a coarse series' slots.
 *
 * @param series - The series.
 * @param slots - Root slots, ascending.
 * @returns The own slots' first Root slots.
 */
export function ownFirsts(series: SeriesModel, slots: readonly number[]): number[] {
  return [...new Set(slots.map((slot) => ownSlot(series, slot)[0]))];
}

/**
 * The coarsest series among some, whose own slot a layout's band crosshair spans.
 *
 * @param series - The layout's series.
 * @returns The series with the coarsest interval, the first of a tie, or undefined when none is coarse.
 */
export function coarsestOf(series: readonly SeriesModel[]): SeriesModel | undefined {
  let best: SeriesModel | undefined;
  for (const candidate of series) {
    const rank = candidate.coarse === undefined ? -1 : ORDER.indexOf(candidate.coarse.interval);
    const bestRank = best?.coarse === undefined ? -1 : ORDER.indexOf(best.coarse.interval);
    if (rank > bestRank) best = candidate;
  }
  return best;
}
