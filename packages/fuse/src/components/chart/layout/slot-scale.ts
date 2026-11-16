/**
 * Where the slots of the effective window sit along the slot axis. Every slot is one option, one
 * tooltip readout, one table row and one spoken item on any scale. The scale decides only where a
 * slot's center lies and which part of the plot its cell owns. Band slots center in equal cells,
 * point slots run from the first edge to the last at an even step, and linear slots sit at their x
 * values over the x domain, so unevenly spaced numbers keep their true distances.
 */
import type { CartesianModel } from "./cartesian-model";
import { BUCKETS, shareSplit, slotSplit } from "./decimate";
import type { BucketSplit } from "./decimate";
import { sameItems } from "./same-items";
import { domainShare } from "./tick-fit";
import { EMPTY_DOMAIN } from "./value-domain";
import type { ValueDomain } from "./value-domain";

/**
 * The slots of a linear x axis over the effective window, as shares of the plot's length along the
 * slot axis.
 */
export type LinearSlots = {
  readonly kind: "linear";
  /**
   * Each window slot's x as a share of the x domain, from 0 at its lower bound to 1 at its upper
   * bound, ascending, by the slot's place in the window.
   */
  readonly centers: readonly number[];
  /**
   * The share every bar is centered on and fills its bar share of: the smallest distance between two
   * neighboring slots, or one tick step of the x domain for a window of one slot.
   */
  readonly pitch: number;
};

/** How a cartesian Root spaces its slots: Root's `xScale`, which a linear axis carries its slots in. */
export type SlotScale = "band" | "point" | LinearSlots;

/**
 * Whether a slot scale is a linear axis's, which places its slots at their values.
 *
 * @param scale - The scale.
 * @returns Whether it carries linear slots.
 */
export function isLinearScale(scale: SlotScale): scale is LinearSlots {
  return scale !== "band" && scale !== "point";
}

/**
 * The linear slots of a window: each slot's x as a share of the x domain, and the bar pitch.
 *
 * @param values - Each window slot's x, ascending.
 * @param x - The x domain and its ticks.
 * @returns The slots.
 */
export function linearSlots(values: readonly number[], x: ValueDomain): LinearSlots {
  const [low, high] = x.domain;
  const span = high - low;
  const centers = values.map((value) => domainShare(x.domain, value));
  let pitch = Number.POSITIVE_INFINITY;
  for (let index = 1; index < centers.length; index += 1) {
    pitch = Math.min(pitch, (centers[index] ?? 0) - (centers[index - 1] ?? 0));
  }
  if (!Number.isFinite(pitch)) {
    const [first, second] = x.ticks;
    pitch = first === undefined || second === undefined || span === 0 ? 1 : (second - first) / span;
  }
  return { kind: "linear", centers, pitch };
}

/** What a model's linear slots read: its x domain, its window and the x domain's bounds. */
type LinearModel = Pick<CartesianModel, "domain" | "window" | "x">;

/** Each model's linear slots, which Root's scale and every decimated series of the model read. */
const modelSlots = new WeakMap<LinearModel, LinearSlots>();

/**
 * The linear slots of a model's effective window, or null on a time or category axis.
 *
 * @param model - Root's model.
 * @returns The slots, built once per model.
 */
export function windowLinearSlots(model: LinearModel): LinearSlots | null {
  const { domain, window, x } = model;
  if (domain.kind !== "linear") return null;
  const known = modelSlots.get(model);
  if (known !== undefined) return known;
  const values = window === null ? [] : domain.values.slice(window.first, window.last + 1);
  const slots = linearSlots(values, x ?? EMPTY_DOMAIN);
  modelSlots.set(model, slots);
  return slots;
}

/**
 * Where a model's decimated window splits into buckets: by pixel column on a linear axis, whose
 * slots sit at their values, so the entries one bucket draws are the entries one column of the plot
 * shows, and by entry index on any other axis, whose entries lie evenly.
 *
 * @param model - Root's model.
 * @param places - The window place of each entry the split buckets, ascending, as `ownCenter` gives
 *   a coarse series' slots, whose sequence holds one entry per coarse slot. Every window slot by
 *   default, as a series on Root's interval draws them.
 * @param buckets - How many buckets the window splits into, 500 by default.
 * @returns The split, over the entries' indexes.
 */
export function windowSplit(
  model: LinearModel,
  places?: readonly number[],
  buckets: number = BUCKETS
): BucketSplit {
  const linear = windowLinearSlots(model);
  if (linear === null) {
    const { window } = model;
    return slotSplit(places?.length ?? (window === null ? 0 : window.last - window.first + 1), buckets);
  }
  const { centers } = linear;
  const shares =
    places === undefined ? centers : places.map((place) => centerShare(linear, centers.length, place));
  return shareSplit(shares, buckets);
}

/** The step from one center to its neighbor at an end of the window, which a linear axis extends past it. */
function endStep(slots: LinearSlots, at: "first" | "last"): number {
  const { centers } = slots;
  const count = centers.length;
  if (count < 2) return slots.pitch;
  return at === "first"
    ? (centers[1] ?? 0) - (centers[0] ?? 0)
    : (centers[count - 1] ?? 0) - (centers[count - 2] ?? 0);
}

/**
 * A window position's center along the slot axis, as a share of the plot's length. A position
 * between two slots, as a tween frame draws, lies between their centers, and a position past
 * either end of the window steps on by the end's own step, as a vertex that slides in or out does.
 *
 * @param scale - Root's x scale.
 * @param count - The window's slot count, at least 1.
 * @param position - The place in the window, from 0, possibly fractional or outside the window.
 * @returns The share, 0 to 1 inside the window.
 */
export function centerShare(scale: SlotScale, count: number, position: number): number {
  if (scale === "band") return (position + 0.5) / count;
  if (scale === "point") return count === 1 ? 0.5 : position / (count - 1);
  const { centers } = scale;
  const last = centers.length - 1;
  if (last < 0) return 0.5;
  if (position <= 0) return (centers[0] ?? 0) + position * endStep(scale, "first");
  if (position >= last) return (centers[last] ?? 0) + (position - last) * endStep(scale, "last");
  const below = Math.floor(position);
  const from = centers[below] ?? 0;
  const to = centers[below + 1] ?? from;
  return from + (to - from) * (position - below);
}

/**
 * The cell a linear slot owns for focus, the tooltip and the pointer: from halfway to the previous
 * slot to halfway to the next one, the first cell from the plot's start and the last to its end,
 * so the cells tile the plot and each point of it belongs to the nearest slot.
 *
 * @param slots - The linear slots.
 * @param position - The slot's place in the window, from 0.
 * @returns The cell's start and end as shares of the plot's length.
 */
export function linearCell(slots: LinearSlots, position: number): readonly [number, number] {
  const { centers } = slots;
  const center = centers[position] ?? 0.5;
  const before = centers[position - 1];
  const after = centers[position + 1];
  return [before === undefined ? 0 : (before + center) / 2, after === undefined ? 1 : (center + after) / 2];
}

/**
 * The linear slot whose center lies nearest a share of the plot's length, the slot whose cell holds
 * it. A share exactly between two centers picks the later slot, as a band's half-open cell does.
 *
 * @param slots - The linear slots.
 * @param share - The share of the plot's length.
 * @returns The slot's place in the window, clamped to the window, 0 for a window of no slots.
 */
export function nearestLinear(slots: LinearSlots, share: number): number {
  const { centers } = slots;
  let low = 0;
  let high = centers.length - 1;
  // The first slot whose cell ends past the share.
  while (low < high) {
    const middle = (low + high) >> 1;
    const end = ((centers[middle] ?? 0) + (centers[middle + 1] ?? 0)) / 2;
    if (end > share) high = middle;
    else low = middle + 1;
  }
  return low;
}

/**
 * Whether two slot scales place every slot alike: the same name, or two linear scales with the same
 * centers and pitch, as a data update that keeps every x and the domain builds them.
 *
 * @param a - One scale.
 * @param b - The other.
 * @returns Whether they match.
 */
export function sameSlotScale(a: SlotScale, b: SlotScale): boolean {
  if (a === b) return true;
  if (!isLinearScale(a) || !isLinearScale(b)) return false;
  return a.pitch === b.pitch && sameItems(a.centers, b.centers);
}
