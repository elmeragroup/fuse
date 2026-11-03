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
import { slotId, slotIds } from "./slot-keys";
import type { XDomain } from "./x-domain";

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

/** One window's slots, beside the window they list. */
type WindowEntry = { readonly first: number; readonly count: number; readonly slots: PathSlots };

/**
 * The window's slots by domain and update keys, at the last window asked for, which every path of
 * one commit shares, and a value update that keeps the domain and the window reuses.
 */
const windows = new WeakMap<XDomain, WeakMap<readonly string[], WindowEntry>>();

/**
 * Every Root slot of a model's effective window: the key each renders under and its identity,
 * built once per domain, window and update keys.
 *
 * @param model - Root's model.
 * @param keys - The key each domain slot renders under, from Root's update.
 * @returns The window's slots, empty for an empty window.
 */
export function windowSlots(model: CartesianModel, keys: readonly string[]): PathSlots {
  const byKeys = windows.get(model.domain) ?? new WeakMap<readonly string[], WindowEntry>();
  windows.set(model.domain, byKeys);
  const window = model.window;
  const count = window === null ? 0 : window.last - window.first + 1;
  const first = window?.first ?? 0;
  const cached = byKeys.get(keys);
  if (cached?.first === first && cached.count === count) return cached.slots;
  const ids = slotIds(model.domain);
  // A window over the whole domain lists the domain's own keys and identities.
  const whole = first === 0 && count === ids.length;
  const slots: PathSlots = {
    keys:
      whole && keys.length === count
        ? keys
        : Array.from(
            { length: count },
            (_, index) => keys[first + index] ?? slotId(model.domain, first + index)
          ),
    ids: whole ? ids : ids.slice(first, first + count),
  };
  byKeys.set(keys, { first, count, slots });
  return slots;
}

/**
 * The resolution a path lays out at: none for a window of `DECIMATE_ABOVE` slots or fewer, which
 * keeps every slot at any width, else the whole pixel columns M4 splits the window into, as
 * `m4Indexes` rounds them. Two widths in one bucket count share one path.
 *
 * @param model - Root's model.
 * @param columns - The plot's length along the slot axis in pixel columns, or none before it is measured.
 * @returns The resolution, or undefined where the path does not depend on one.
 */
export function pathResolution(
  model: Pick<CartesianModel, "window">,
  columns: number | undefined
): number | undefined {
  const window = model.window;
  if (columns === undefined || window === null || window.last - window.first + 1 <= DECIMATE_ABOVE) {
    return undefined;
  }
  return Math.max(1, Math.round(columns));
}

/** One owner's value at the one resolution it holds, which a miss replaces. */
type AtResolution<T> = { readonly resolution: number | undefined; readonly value: T };

/**
 * The decimated slots each stack plans by model, which every member of the stack draws, at the
 * last resolution the stack asked for.
 */
const plans = new WeakMap<CartesianModel, Map<string, AtResolution<readonly number[]>>>();

/** Whether every slot holds a value. */
function isFilled(values: readonly (number | null)[]): values is readonly number[] {
  return !values.includes(null);
}

/**
 * Fill the values of slots without a reading: linearly between the readings around them, and with
 * the nearest reading's value before the first and after the last. A series with no reading lies
 * at 0.
 */
function interpolated(values: readonly (number | null)[]): readonly number[] {
  // A window with a reading at every slot, as a live stream's is, fills nothing.
  if (isFilled(values)) return values;
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

/** Each slot's two vertex ends, by slot position, null where the slot holds no reading. */
type SlotEnds = { readonly tops: (number | null)[]; readonly bases: (number | null)[] };

/**
 * The two ends each slot's vertex draws: its outer end, which the path passes through, and its
 * inner one, which an Area fills down to. A part below zero hangs from its high end.
 */
function endsOf(series: SeriesModel, slots: readonly number[]): SlotEnds {
  const tops: (number | null)[] = [];
  const bases: (number | null)[] = [];
  for (const slot of slots) {
    const extent = series.extents[slot];
    if (series.readings[slot]?.kind !== "reading" || !extent) {
      tops.push(null);
      bases.push(null);
      continue;
    }
    const [low, high] = extent;
    const hangs = low < 0 && high <= 0;
    tops.push(hangs ? low : high);
    bases.push(hangs ? high : low);
  }
  return { tops, bases };
}

/** The side of zero a stacked reading's extent lies on. */
function sideOf(series: SeriesModel, slot: number): "positive" | "negative" | null {
  const extent = series.extents[slot];
  if (series.stack === undefined || series.readings[slot]?.kind !== "reading" || !extent) return null;
  return extent[0] < 0 && extent[1] <= 0 ? "negative" : "positive";
}

/** Each state and quality a vertex draws in, as a small number. A state with no quality takes 3. */
const STATE_LOOK = { reading: 0, missing: 1, pending: 2 } as const;
const QUALITY_LOOK = { measured: 0, estimated: 1, corrected: 2 } as const;

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
  // Every member of a stack keeps the same slots, so the stack plans them once per resolution. A
  // coarse member walks its own slots, so it plans alone.
  const planned = plans.get(model) ?? new Map<string, AtResolution<readonly number[]>>();
  plans.set(model, planned);
  const owner =
    series.coarse === undefined && series.stack !== undefined ? `stack ${series.stack}` : `key ${series.key}`;
  const cached = planned.get(owner);
  if (cached !== undefined && cached.resolution === columns) return [...cached.value];
  const stack = model.stacks.find(({ id: stackId }) => stackId === series.stack);
  const members = stack === undefined ? [series] : model.series.filter(({ key }) => stack.keys.includes(key));
  const kept = new Set([first, last]);
  for (const member of members) {
    // Both ends `endsOf` gives each slot, null where it holds no reading, and what each vertex
    // draws as besides where, in one pass. A look is one number for the state, the quality, the
    // side, as `sideOf` gives it, and the projection, so two slots draw alike exactly when their
    // looks match. A slot past the readings draws as pending.
    const tops: (number | null)[] = [];
    // The bases stay unlisted while every base is one value, the common line on zero.
    let bases: (number | null)[] | undefined;
    let base: number | null = null;
    let previousLook = -1;
    for (let index = 0; index < count; index += 1) {
      const slot = all[index] ?? first;
      const reading = member.readings[slot];
      const extent = member.extents[slot];
      let side = 0;
      if (reading?.kind === "reading" && extent) {
        const [low, high] = extent;
        const hangs = low < 0 && high <= 0;
        const own = hangs ? high : low;
        base ??= own;
        if (bases === undefined && own !== base) {
          const shared = base;
          bases = tops.map((top) => (top === null ? null : shared));
        }
        tops.push(hangs ? low : high);
        bases?.push(own);
        if (member.stack !== undefined) side = hangs ? 2 : 1;
      } else {
        tops.push(null);
        bases?.push(null);
      }
      const state = reading === undefined ? STATE_LOOK.pending : STATE_LOOK[reading.kind];
      const quality = reading?.kind === "reading" ? QUALITY_LOOK[reading.quality] : 3;
      const look = ((state * 4 + quality) * 3 + side) * 2 + Number(slot >= member.projectedFrom);
      if (index > 0 && look !== previousLook) {
        kept.add(all[index - 1] ?? slot);
        kept.add(slot);
      }
      previousLook = look;
    }
    for (const index of m4Indexes(tops, columns)) kept.add(all[index] ?? first);
    // Bases of one value keep each bucket's first and last reading under M4, which the tops,
    // read at the same slots, keep already.
    if (bases !== undefined) for (const index of m4Indexes(bases, columns)) kept.add(all[index] ?? first);
  }
  const sorted = [...kept].toSorted((a, b) => a - b);
  planned.set(owner, { resolution: columns, value: sorted });
  return [...sorted];
}

/**
 * Lay out one series' path over the effective window.
 *
 * @param model - Root's model.
 * @param series - The series.
 * @param keys - The key each domain slot renders under, from Root's update.
 * @param resolution - The whole pixel columns a decimated window splits into, as `pathResolution`
 *   normalises them. Without it a decimated window keeps M4's default 500 buckets.
 * @returns The vertices, empty for an empty window.
 */
export function seriesPath(
  model: CartesianModel,
  series: SeriesModel,
  keys: readonly string[],
  resolution?: number
): SeriesPath {
  const window = model.window;
  if (window === null) {
    return { vertices: [], keys: [], ids: [], positions: [], window: { keys: [], ids: [] } };
  }
  // A coarse series draws one vertex per own slot, at the slot's middle, keyed by its first Root slot.
  // A vertex per own slot: every slot, or each coarse slot's first.
  const own = ownWindowFirsts(series, window);
  const slots = drawnSlots(model, series, own, resolution);
  const ends = endsOf(series, slots);
  const tops = interpolated(ends.tops);
  const bases = interpolated(ends.bases);
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
  const whole = windowSlots(model, keys);
  const drawn =
    slots.length === whole.keys.length
      ? whole
      : {
          keys: slots.map((slot) => keys[slot] ?? slotId(model.domain, slot)),
          ids: slots.map((slot) => slotId(model.domain, slot)),
        };
  return { vertices, ...drawn, positions: vertices.map(({ position }) => position), window: whole };
}

/** The series paths by model, update keys and series, each at the last resolution it was asked for. */
const shared = new WeakMap<
  CartesianModel,
  WeakMap<readonly string[], Map<string, AtResolution<SeriesPath>>>
>();

/**
 * One series' path, laid out once per model, update keys and resolution, so a Line, an Area and
 * the Dots on one series share it, M4 pass and all. Each series keeps its path at one resolution,
 * which a resize replaces, so a drag across many widths holds one path per series.
 *
 * @param model - Root's model.
 * @param series - The series, one of the model's.
 * @param keys - The key each domain slot renders under, from Root's update.
 * @param columns - The plot's length along the slot axis in pixel columns, which `pathResolution`
 *   normalises.
 * @returns The path `seriesPath` lays out.
 */
export function seriesPathOf(
  model: CartesianModel,
  series: SeriesModel,
  keys: readonly string[],
  columns?: number
): SeriesPath {
  const byKeys = shared.get(model) ?? new WeakMap<readonly string[], Map<string, AtResolution<SeriesPath>>>();
  shared.set(model, byKeys);
  const bySeries = byKeys.get(keys) ?? new Map<string, AtResolution<SeriesPath>>();
  byKeys.set(keys, bySeries);
  const resolution = pathResolution(model, columns);
  const cached = bySeries.get(series.key);
  if (cached !== undefined && cached.resolution === resolution) return cached.value;
  const path = seriesPath(model, series, keys, resolution);
  bySeries.set(series.key, { resolution, value: path });
  return path;
}
