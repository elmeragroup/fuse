/**
 * The vertices a Line or an Area draws for one series, in data units, after CONTRACT sections 8.6,
 * 8.7 and 8.12. Every slot of the effective window is a vertex, so a path keeps one vertex per slot
 * key across updates and a reading that appears grows out of the line it joins. A slot with no
 * reading still holds a value, interpolated from its neighbours, which only a tween reads; the
 * vertex's state keeps it out of the drawn path. Above `DECIMATE_ABOVE` slots the window keeps, for
 * each pixel column, the M4 slots of every boundary its stack draws, shared by every member, and
 * both slots of every change of state, quality, projection or stack side, so a gap, a dash and a
 * stack's peaks draw as the full window does.
 */
import type { CartesianModel, SeriesModel } from "./cartesian-model";
import { ownCentre, ownSpan, ownWindowFirsts } from "./coarse-slots";
import { DECIMATE_ABOVE, m4Indexes } from "./decimate";
import type { PathSlots } from "./path-motion";
import type { ReadingQuality } from "./readings";

/** What a vertex's slot holds for the series: a reading, a missing reading or one still to come. */
export type VertexState = "reading" | "missing" | "pending";

/** One vertex of a series path. */
export type PathVertex = {
  /** The domain slot. */
  readonly slot: number;
  /** The slot's place in the effective window, from 0. */
  readonly position: number;
  /**
   * The value the path passes through: the reading, or a stacked series' outer end, interpolated
   * for a slot without one.
   */
  readonly top: number;
  /** The value an Area fills down to: 0, or the inner end of a stacked series. */
  readonly base: number;
  readonly state: VertexState;
  /** The reading's quality, "measured" for a slot without a reading. */
  readonly quality: ReadingQuality;
  /** Whether the slot lies at or after config `projectedFrom`. */
  readonly projected: boolean;
  /**
   * The side of zero a stacked series' reading stacks on, which a run of the path keeps, or null for
   * a loose series and a slot without a reading.
   */
  readonly side: "positive" | "negative" | null;
  /**
   * How many of the window's Root cells the vertex's own slot covers, 1 but for a coarse series,
   * whose step run spans them all.
   */
  readonly cells: number;
};

/** A series path: its vertices, the key and slot identity each renders under, and the window's slots. */
export type SeriesPath = {
  readonly vertices: readonly PathVertex[];
  readonly keys: readonly string[];
  readonly ids: readonly string[];
  /** Each vertex's place in the window. */
  readonly positions: readonly number[];
  /**
   * Every Root slot of the effective window, which a decimated path and a coarse series draw only
   * some of, so an update's motion reads off the window's slots, in the Root slots its positions
   * count, and not off the vertices the path happens to keep.
   */
  readonly window: PathSlots;
};

/** A slot's identity: its start instant on a time axis or its name on a category axis. */
function slotId(model: CartesianModel, slot: number): string {
  const { domain } = model;
  return domain.kind === "time" ? String(domain.starts[slot] ?? slot) : (domain.names[slot] ?? String(slot));
}

/**
 * Fill the values of slots without a reading: linearly between the readings around them, and with
 * the nearest reading's value before the first and after the last. A series with no reading lies
 * at 0.
 */
function interpolated(values: readonly (number | null)[]): number[] {
  // The nearest reading before and after each slot, found in one pass each way.
  const before: (number | undefined)[] = [];
  let last: number | undefined;
  values.forEach((value, index) => {
    if (value !== null) last = index;
    before.push(last);
  });
  const after: (number | undefined)[] = Array.from({ length: values.length });
  let next: number | undefined;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] !== null) next = index;
    after[index] = next;
  }
  return values.map((value, index) => {
    if (value !== null) return value;
    const left = before[index];
    const right = after[index];
    const leftValue = left === undefined ? null : (values[left] ?? null);
    const rightValue = right === undefined ? null : (values[right] ?? null);
    if (left === undefined || right === undefined || leftValue === null || rightValue === null) {
      return leftValue ?? rightValue ?? 0;
    }
    return leftValue + ((rightValue - leftValue) * (index - left)) / (right - left);
  });
}

/**
 * The two ends a reading's vertex draws: its outer end, which the path passes through, and its inner
 * one, which an Area fills down to. A part below zero hangs from its high end.
 */
function endsOf(series: SeriesModel, slot: number): { readonly top: number; readonly base: number } | null {
  const extent = series.extents[slot];
  if (series.readings[slot]?.kind !== "reading" || !extent) return null;
  const [low, high] = extent;
  return low < 0 && high <= 0 ? { top: low, base: high } : { top: high, base: low };
}

/** The side of zero a stacked reading's extent lies on. */
function sideOf(series: SeriesModel, slot: number): "positive" | "negative" | null {
  const extent = series.extents[slot];
  if (series.stack === undefined || series.readings[slot]?.kind !== "reading" || !extent) return null;
  return extent[0] < 0 && extent[1] <= 0 ? "negative" : "positive";
}

/** What a slot's vertex draws as, besides where: its state, its quality, its projection and its side. */
function classOf(series: SeriesModel, slot: number): string {
  const reading = series.readings[slot];
  const quality = reading?.kind === "reading" ? reading.quality : "";
  return `${reading?.kind ?? "pending"} ${quality} ${String(slot >= series.projectedFrom)} ${String(sideOf(series, slot))}`;
}

/**
 * The slots a window draws: all of them up to `DECIMATE_ABOVE`. Above it a series in a stack plans
 * its slots with every member, so neighbouring areas draw one shared boundary. Each member keeps
 * each pixel column's M4 slots of both ends its vertices draw, which are the stack's cumulative
 * boundaries, and the slots on both sides of every change in what a vertex draws as, so a gap, a
 * dash, a projected tail and a sign change keep their edges.
 */
function drawnSlots(
  model: CartesianModel,
  series: SeriesModel,
  all: readonly number[],
  columns: number | undefined
): number[] {
  const count = all.length;
  const first = all[0] ?? 0;
  const last = all.at(-1) ?? 0;
  if (count <= DECIMATE_ABOVE) return [...all];
  const stack = model.stacks.find(({ id }) => id === series.stack);
  const members = stack === undefined ? [series] : model.series.filter(({ key }) => stack.keys.includes(key));
  const kept = new Set([first, last]);
  for (const member of members) {
    for (const end of ["top", "base"] as const) {
      const values = all.map((slot) => endsOf(member, slot)?.[end] ?? null);
      for (const index of m4Indexes(values, columns)) kept.add(all[index] ?? first);
    }
    let previous = classOf(member, first);
    all.forEach((slot, index) => {
      if (index === 0) return;
      const next = classOf(member, slot);
      if (next !== previous) {
        kept.add(all[index - 1] ?? slot);
        kept.add(slot);
      }
      previous = next;
    });
  }
  return [...kept].toSorted((a, b) => a - b);
}

/**
 * Lay out one series' path over the effective window.
 *
 * @param model - Root's model.
 * @param series - The series.
 * @param keys - The key each domain slot renders under, from Root's update.
 * @param columns - The plot's length along the slot axis in pixel columns, which a decimated window
 *   splits into. Without it a decimated window keeps M4's default 500 buckets.
 * @returns The vertices, empty for an empty window.
 */
export function seriesPath(
  model: CartesianModel,
  series: SeriesModel,
  keys: readonly string[],
  columns?: number
): SeriesPath {
  const window = model.window;
  if (window === null) {
    return { vertices: [], keys: [], ids: [], positions: [], window: { keys: [], ids: [] } };
  }
  // A coarse series draws one vertex per own slot, at the slot's middle, keyed by its first Root slot.
  // A vertex per own slot: every slot, or each coarse slot's first.
  const own = ownWindowFirsts(series, window);
  const slots = drawnSlots(model, series, own, columns);
  const ends = slots.map((slot) => endsOf(series, slot));
  const tops = interpolated(ends.map((end) => end?.top ?? null));
  const bases = interpolated(ends.map((end) => end?.base ?? null));
  const vertices = slots.map((slot, index): PathVertex => {
    const reading = series.readings[slot];
    return {
      slot,
      position: ownCentre(series, window, slot),
      top: tops[index] ?? 0,
      // A series with no reading at all fills nothing.
      base: bases[index] ?? 0,
      state: reading?.kind ?? "pending",
      quality: reading?.kind === "reading" ? reading.quality : "measured",
      projected: slot >= series.projectedFrom,
      side: sideOf(series, slot),
      cells: ownSpan(series, window, slot).span,
    };
  });
  const keyOf = (slot: number) => keys[slot] ?? slotId(model, slot);
  const drawn = { keys: slots.map(keyOf), ids: slots.map((slot) => slotId(model, slot)) };
  const count = window.last - window.first + 1;
  const whole =
    slots.length === count
      ? drawn
      : {
          keys: Array.from({ length: count }, (_, index) => keyOf(window.first + index)),
          ids: Array.from({ length: count }, (_, index) => slotId(model, window.first + index)),
        };
  return { vertices, ...drawn, positions: vertices.map(({ position }) => position), window: whole };
}
