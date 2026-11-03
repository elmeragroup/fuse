/**
 * X-axis tick thinning, as CONTRACT section 8.11 defines it. Labels never rotate. Candidates sit on
 * whole wall-clock units, and for each container width bucket the axis picks the smallest stride
 * whose labels fit, from width estimates the server makes. A wider bucket never takes a larger
 * stride, so the label count never falls as the axis grows. After the interval's own strides come
 * the strides of coarser calendar units, so a year of hours can fall back to month starts.
 */
import { wallTimes } from "../format/time-format";
import type { Interval } from "../format/time-format";
import type { XDomain } from "./x-domain";

/** The ticks one stride draws. */
export type TickStride = {
  /** The stride in its calendar unit, such as hours, days or rows. */
  readonly stride: number;
  /**
   * The calendar unit the stride counts, which is the interval itself or a coarser unit, or
   * `"row"` on a category axis.
   */
  readonly unit: Interval | "row";
  /** The slots that carry a tick, ascending. */
  readonly slots: readonly number[];
};

/**
 * The container widths, in CSS pixels, at which the axis may show more labels. `chart.css` holds
 * one container rule per width. The narrow ones give a phone's plot, or a 229 px plot beside a
 * y axis, a coarser stride of its own rather than the first label alone.
 */
export const TICK_BUCKETS = [
  120, 160, 200, 240, 280, 320, 360, 400, 440, 480, 560, 640, 720, 800, 880, 960, 1040, 1120, 1200,
] as const;

/** The space every label keeps from its neighbour, in CSS pixels. */
export const LABEL_GAP = 8;

const SECOND = 1_000;
const MINUTE = 60_000;
const HOUR = 3_600_000;

/** The remainder of `value / divisor` that takes the divisor's sign, as a clock field needs. */
function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** A wall-clock time read as a UTC instant, whole seconds, as `wallTimes` gives it. */
type WallTime = number;

/** The seconds since the wall clock's midnight. */
const secondOfDay = (wall: WallTime): number => mod(Math.floor(wall / SECOND), 86_400);

type Rule = {
  /** The strides, finest first. */
  readonly strides: readonly number[];
  /** Whether a slot is a candidate at all, such as a whole hour on a quarter-hour axis. */
  readonly candidate: (wall: WallTime) => boolean;
  /** The slot's position in the stride's unit, which a tick's stride must divide. */
  readonly unit: (wall: WallTime, slot: number) => number;
};

const RULES = {
  second: {
    strides: [1, 5, 10, 15, 30, 60, 300, 600, 900, 1800, 3600],
    candidate: () => true,
    unit: secondOfDay,
  },
  minute: {
    strides: [1, 5, 10, 15, 30, 60],
    candidate: (wall) => mod(Math.floor(wall / SECOND), 60) === 0,
    unit: (wall) => mod(Math.floor(wall / MINUTE), 1_440),
  },
  "quarter-hour": {
    strides: [1, 2, 3, 6, 12],
    candidate: (wall) => mod(Math.floor(wall / SECOND), 3_600) === 0,
    unit: (wall) => mod(Math.floor(wall / HOUR), 24),
  },
  hour: {
    strides: [1, 2, 3, 6, 12],
    candidate: (wall) => mod(Math.floor(wall / SECOND), 3_600) === 0,
    unit: (wall) => mod(Math.floor(wall / HOUR), 24),
  },
  day: { strides: [1, 2, 7, 14], candidate: () => true, unit: (wall) => new Date(wall).getUTCDate() - 1 },
  week: { strides: [1, 2, 4, 13], candidate: () => true, unit: (_, slot) => slot },
  month: { strides: [1, 2, 3, 6], candidate: () => true, unit: (wall) => new Date(wall).getUTCMonth() },
  year: { strides: [1, 2, 5, 10], candidate: () => true, unit: (wall) => new Date(wall).getUTCFullYear() },
} as const satisfies Readonly<Record<Interval, Rule>>;

const CATEGORY_STRIDES = [1, 2, 3, 4, 6, 12, 24, 48] as const;

/** The coarser calendar units whose starts can carry an interval's ticks, finest first. */
const COARSER = {
  second: ["day", "month", "year"],
  minute: ["day", "month", "year"],
  "quarter-hour": ["day", "month", "year"],
  hour: ["day", "month", "year"],
  day: ["month", "year"],
  week: [],
  month: ["year"],
  year: [],
} as const satisfies Readonly<Record<Interval, readonly Interval[]>>;

/** Whether a wall-clock time starts a unit of each coarser kind. */
const STARTS = {
  day: (wall: WallTime) => secondOfDay(wall) === 0,
  month: (wall: WallTime) => STARTS.day(wall) && new Date(wall).getUTCDate() === 1,
  year: (wall: WallTime) => STARTS.month(wall) && new Date(wall).getUTCMonth() === 0,
} as const;

/** The slots of a list whose position in the list a stride divides. */
function everyNth(count: number, stride: number): number[] {
  const slots: number[] = [];
  for (let slot = 0; slot < count; slot += stride) slots.push(slot);
  return slots;
}

/**
 * The tick candidates of each stride. On a time axis a label sits on a whole wall-clock unit,
 * never on a slot index, and the second of two slots that share a wall-clock start, as the repeated
 * fall-back hour does, gets no tick. A category axis counts rows from the first.
 *
 * @param domain - The x domain.
 * @returns One entry per stride, finest first.
 */
export function tickStrides(domain: XDomain): TickStride[] {
  if (domain.kind === "category") {
    return CATEGORY_STRIDES.map((stride) => ({
      stride,
      unit: "row",
      slots: everyNth(domain.names.length, stride),
    }));
  }
  const walls = wallTimes(domain.starts, domain.timeZone);
  // The starts ascend, so a slot whose wall clock lies at or before the latest one so far repeats
  // it, as the fall-back hour's second pass does, and only the first pass ticks. Every coarser
  // unit starts at a midnight, so its tiers read the first-pass midnights alone.
  const own: Rule = RULES[domain.interval];
  const ownSlots = own.strides.map((): number[] => []);
  const midnights: number[] = [];
  let latest = Number.NEGATIVE_INFINITY;
  for (let slot = 0; slot < walls.length; slot += 1) {
    const wall = walls[slot] ?? 0;
    if (wall <= latest) continue;
    latest = wall;
    if (secondOfDay(wall) === 0) midnights.push(slot);
    if (own.candidate(wall)) addToStrides(ownSlots, own, wall, slot);
  }
  const coarser = COARSER[domain.interval].flatMap((unit) => {
    const rule: Rule = RULES[unit];
    const slots = rule.strides.map((): number[] => []);
    for (const slot of midnights) {
      const wall = walls[slot] ?? 0;
      if (STARTS[unit](wall)) addToStrides(slots, rule, wall, slot);
    }
    return stridesOf(unit, slots);
  });
  return [...stridesOf(domain.interval, ownSlots), ...coarser];
}

/** Add a candidate slot to each stride of its rule that divides its unit position. */
function addToStrides(lists: readonly number[][], rule: Rule, wall: WallTime, slot: number): void {
  const unit = rule.unit(wall, slot);
  const { strides } = rule;
  for (let index = 0; index < strides.length; index += 1) {
    if (unit % (strides[index] ?? 1) === 0) lists[index]?.push(slot);
  }
}

/** One tier's strides from the slots each holds, finest first. */
function stridesOf(unit: Interval, lists: readonly number[][]): TickStride[] {
  const rule: Rule = RULES[unit];
  return rule.strides.map((stride, index) => ({ stride, unit, slots: lists[index] ?? [] }));
}

/** What the thinning reads about each label. */
export type TickGeometry = {
  /** A slot's tick position as a fraction of the axis width. */
  readonly position: (slot: number) => number;
  /**
   * A slot's estimated label width in CSS pixels, never negative. The thinning reads a label only
   * when a fit check reaches it, so a geometry that formats labels on demand formats few of them.
   */
  readonly width: (slot: number) => number;
};

/**
 * Where a label's box starts on an axis of `axisWidth` pixels. CSS clamps each label inside the
 * axis box, so an edge label shifts inward.
 */
function labelStart(slot: number, geometry: TickGeometry, axisWidth: number): number {
  const width = geometry.width(slot);
  return Math.min(Math.max(geometry.position(slot) * axisWidth - width / 2, 0), axisWidth - width);
}

/** The neighbouring pairs the crowding probe checks, spread evenly over a stride. */
const PROBES = 8;

/**
 * Whether a few evenly spread neighbouring pairs prove that a stride's labels crowd each other.
 * Labels a gap apart are the densest that fit, so at most `axisWidth / LABEL_GAP + 1` of them fit,
 * and a stride of more slots usually crowds everywhere: 100,000 minutes hold 1,667 hours, against
 * at most 151 labels at 1,200 px. A pair is proof when neither label gives way to the first label,
 * since the fit check then reaches the second right after the first and fails there. So a dense
 * stride fails after a few labels, not after every slot that gives way to the first. A probe that
 * proves nothing leaves the verdict to the full check.
 */
function crowded(
  slots: readonly number[],
  clear: number,
  geometry: TickGeometry,
  axisWidth: number
): boolean {
  if (slots.length <= Math.floor(axisWidth / LABEL_GAP) + 1) return false;
  for (let probe = 1; probe <= PROBES; probe += 1) {
    const index = Math.floor(((slots.length - 1) * probe) / (PROBES + 1));
    const left = slots[index];
    const right = slots[index + 1];
    if (left === undefined || right === undefined) continue;
    const leftStart = labelStart(left, geometry, axisWidth);
    const rightStart = labelStart(right, geometry, axisWidth);
    if (
      leftStart >= clear &&
      rightStart >= clear &&
      rightStart < leftStart + geometry.width(left) + LABEL_GAP
    ) {
      return true;
    }
  }
  return false;
}

/**
 * A stride's labels on an axis of `axisWidth` pixels, led by the always-shown first candidate, or
 * undefined when two of them crowd each other. A first label off the stride, as a November start
 * is on a calendar-aligned quarterly stride, shows besides the stride, and a slot whose label would
 * crowd it, as January's does, gives way to it, so the rest of the stride still shows. A first
 * label on the stride is one of the stride's own, so a neighbour that crowds it fails the stride as
 * any crowding pair does, and every stride that shows keeps one rhythm. The check reads labels in
 * slot order and stops at the first crowding.
 */
function fittedLabels(
  slots: readonly number[],
  first: number | undefined,
  geometry: TickGeometry,
  axisWidth: number
): number[] | undefined {
  const firstEnd =
    first === undefined
      ? Number.NEGATIVE_INFINITY
      : labelStart(first, geometry, axisWidth) + geometry.width(first);
  const aligned = first !== undefined && hasSlot(slots, first);
  // Slots that start before `clear` give way to the first label. The first label's own start lies
  // before its end, so off the stride it gives way to itself, and on the stride nothing gives way.
  const clear = aligned ? Number.NEGATIVE_INFINITY : firstEnd + LABEL_GAP;
  const labels = first === undefined ? [] : [first];
  // No label starts past the axis's width, so past a first label that ends there every slot gives way.
  if (clear > axisWidth) return labels;
  if (crowded(slots, clear, geometry, axisWidth)) return undefined;
  let previousEnd = firstEnd;
  for (const slot of slots) {
    if (slot === first) continue;
    const start = labelStart(slot, geometry, axisWidth);
    if (start < clear) continue;
    if (start < previousEnd + LABEL_GAP) return undefined;
    labels.push(slot);
    previousEnd = start + geometry.width(slot);
  }
  return labels;
}

/** Whether ascending `slots` holds `slot`. */
function hasSlot(slots: readonly number[], slot: number): boolean {
  let low = 0;
  let high = slots.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const value = slots[middle] ?? Number.NaN;
    if (value === slot) return true;
    if (value < slot) low = middle + 1;
    else high = middle - 1;
  }
  return false;
}

/** Whether ascending `slots` holds every slot of `previous`. */
function holds(slots: readonly number[], previous: readonly number[]): boolean {
  return slots.length >= previous.length && previous.every((slot) => hasSlot(slots, slot));
}

/**
 * Each bucket's shown slots, narrow to wide, or undefined for a bucket no stride fits. A bucket
 * takes the finest stride whose labels fit among the strides that hold every label the last
 * fitted bucket showed besides the first, so a wider bucket shows a superset. The first candidate
 * of the finest stride always shows, and each fit check counts it.
 */
function* bucketPicks(
  strides: readonly Pick<TickStride, "slots">[],
  geometry: TickGeometry
): Generator<readonly [bucket: number, shown: readonly number[] | undefined]> {
  const first = strides[0]?.slots[0];
  let previous: readonly number[] = [];
  for (const bucket of TICK_BUCKETS) {
    let shown: readonly number[] | undefined;
    for (const { slots } of strides) {
      if (!holds(slots, previous)) continue;
      shown = fittedLabels(slots, first, geometry, bucket);
      if (shown !== undefined) break;
    }
    if (shown !== undefined) previous = shown.filter((slot) => slot !== first);
    yield [bucket, shown];
  }
}

/** The narrowest bucket at which a tick shows, `"always"` for the first tick, or `"none"`. */
export type TickVisibility = number | "always" | "none";

/** A tick that shows at some width: from its narrowest bucket on, or always for the first. */
export type ShownTick = { readonly slot: number; readonly visibility: number | "always" };

/**
 * Pick each bucket's stride and report the narrowest bucket at which each shown candidate shows.
 *
 * Buckets run from narrow to wide. Each takes the smallest stride whose labels fit, among the
 * strides that hold every tick of the bucket before it, so every wider bucket shows a superset.
 * The first candidate of the finest stride always shows, and each fit check counts it. A
 * candidate that would crowd the first label gives way to it at that bucket. A candidate that
 * fits no bucket is left out.
 *
 * @param strides - The candidates per stride, finest first, each ascending, from {@link tickStrides}.
 * @param geometry - Each slot's position and estimated label width.
 * @returns The candidates of the finest stride that show at some bucket, in slot order.
 */
export function thinTicks(
  strides: readonly Pick<TickStride, "slots">[],
  geometry: TickGeometry
): ShownTick[] {
  const finest = strides[0]?.slots ?? [];
  const first = finest[0];
  if (first === undefined) return [];
  const shownFrom = new Map<number, number>();
  for (const [bucket, shown] of bucketPicks(strides, geometry)) {
    for (const slot of shown ?? []) {
      if (slot !== first && !shownFrom.has(slot)) shownFrom.set(slot, bucket);
    }
  }
  // Only the finest stride's candidates report, and the first leads them.
  const rest = [...shownFrom]
    .filter(([slot]) => hasSlot(finest, slot))
    .toSorted(([a], [b]) => a - b)
    .map(([slot, visibility]): ShownTick => ({ slot, visibility }));
  return [{ slot: first, visibility: "always" }, ...rest];
}

/**
 * Whether some stride fits every bucket. When the interval's own strides fail a bucket, the axis
 * adds the strides of coarser calendar units. The check stops at the first bucket no stride fits.
 *
 * @param strides - The candidates per stride, finest first, each ascending.
 * @param geometry - Each slot's position and estimated label width.
 * @returns True when every bucket picks a stride.
 */
export function fitsEveryBucket(
  strides: readonly Pick<TickStride, "slots">[],
  geometry: TickGeometry
): boolean {
  for (const [, shown] of bucketPicks(strides, geometry)) {
    if (shown === undefined) return false;
  }
  return true;
}
