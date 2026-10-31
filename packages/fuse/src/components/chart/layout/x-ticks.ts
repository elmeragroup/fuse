/**
 * X-axis tick thinning, as CONTRACT section 8.11 defines it. Labels never rotate. Candidates sit on
 * whole wall-clock units, and for each container width bucket the axis picks the smallest stride
 * whose labels fit, from width estimates the server makes. A wider bucket never takes a larger
 * stride, so the label count never falls as the axis grows. After the interval's own strides come
 * the strides of coarser calendar units, so a year of hours can fall back to month starts.
 */
import type { Interval, WallClock } from "../format/time-format";
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

type Rule = {
  /** The strides, finest first. */
  readonly strides: readonly number[];
  /** Whether a slot is a candidate at all, such as a whole hour on a quarter-hour axis. */
  readonly candidate: (wall: WallClock) => boolean;
  /** The slot's position in the stride's unit, which a tick's stride must divide. */
  readonly unit: (wall: WallClock, slot: number) => number;
};

const RULES = {
  second: {
    strides: [1, 5, 10, 15, 30, 60, 300, 600, 900, 1800, 3600],
    candidate: () => true,
    unit: (wall) => wall.hour * 3600 + wall.minute * 60 + wall.second,
  },
  minute: {
    strides: [1, 5, 10, 15, 30, 60],
    candidate: (wall) => wall.second === 0,
    unit: (wall) => wall.hour * 60 + wall.minute,
  },
  "quarter-hour": {
    strides: [1, 2, 3, 6, 12],
    candidate: (wall) => wall.minute === 0 && wall.second === 0,
    unit: (wall) => wall.hour,
  },
  hour: {
    strides: [1, 2, 3, 6, 12],
    candidate: (wall) => wall.minute === 0 && wall.second === 0,
    unit: (wall) => wall.hour,
  },
  day: { strides: [1, 2, 7, 14], candidate: () => true, unit: (wall) => wall.day - 1 },
  week: { strides: [1, 2, 4, 13], candidate: () => true, unit: (_, slot) => slot },
  month: { strides: [1, 2, 3, 6], candidate: () => true, unit: (wall) => wall.month - 1 },
  year: { strides: [1, 2, 5, 10], candidate: () => true, unit: (wall) => wall.year },
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
  day: (wall: WallClock) => wall.hour === 0 && wall.minute === 0 && wall.second === 0,
  month: (wall: WallClock) => STARTS.day(wall) && wall.day === 1,
  year: (wall: WallClock) => STARTS.month(wall) && wall.month === 1,
} as const;

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
      slots: domain.names.flatMap((_, slot) => (slot % stride === 0 ? [slot] : [])),
    }));
  }
  const { walls } = domain;
  // The starts ascend, so a slot whose wall clock lies at or before the latest one so far repeats
  // it, as the fall-back hour's second pass does, and only the first pass ticks.
  let latest = Number.NEGATIVE_INFINITY;
  const first = walls.map((wall) => {
    const time = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    if (time <= latest) return false;
    latest = time;
    return true;
  });
  const tier = (unit: Interval, starts: (wall: WallClock) => boolean): TickStride[] => {
    const rule = RULES[unit];
    const candidates = walls.flatMap((wall, slot) =>
      first[slot] === true && rule.candidate(wall) && starts(wall)
        ? [{ slot, unit: rule.unit(wall, slot) }]
        : []
    );
    return rule.strides.map((stride) => ({
      stride,
      unit,
      slots: candidates.flatMap((candidate) => (candidate.unit % stride === 0 ? [candidate.slot] : [])),
    }));
  };
  return [
    ...tier(domain.interval, () => true),
    ...COARSER[domain.interval].flatMap((unit) => tier(unit, STARTS[unit])),
  ];
}

/** What the thinning reads about each label. */
export type TickGeometry = {
  /** A slot's tick position as a fraction of the axis width. */
  readonly position: (slot: number) => number;
  /** A slot's estimated label width in CSS pixels. */
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

/** Whether every shown label of a stride fits an axis of `axisWidth` pixels. */
function fits(slots: readonly number[], geometry: TickGeometry, axisWidth: number): boolean {
  let previousEnd = Number.NEGATIVE_INFINITY;
  for (const slot of slots) {
    const start = labelStart(slot, geometry, axisWidth);
    if (start < previousEnd + LABEL_GAP) return false;
    previousEnd = start + geometry.width(slot);
  }
  return true;
}

/**
 * A stride's slots with the always-shown first candidate leading them. A slot whose label would
 * crowd the first label, as a calendar-aligned January does beside a November start, gives way to
 * it, so the rest of the stride still shows.
 */
function withFirst(
  slots: readonly number[],
  first: number | undefined,
  geometry: TickGeometry,
  axisWidth: number
): readonly number[] {
  if (first === undefined) return slots;
  // The first label's own start lies before its end, so the filter leaves it out of the rest.
  const firstEnd = labelStart(first, geometry, axisWidth) + geometry.width(first);
  const rest = slots.filter((slot) => labelStart(slot, geometry, axisWidth) >= firstEnd + LABEL_GAP);
  return [first, ...rest];
}

/** The narrowest bucket at which a tick shows, `"always"` for the first tick, or `"none"`. */
export type TickVisibility = number | "always" | "none";

/**
 * Pick each bucket's stride and report the narrowest bucket at which each candidate shows.
 *
 * Buckets run from narrow to wide. Each takes the smallest stride whose labels fit, among the
 * strides that hold every tick of the bucket before it, so every wider bucket shows a superset.
 * The first candidate of the finest stride always shows, and each fit check counts it. A
 * candidate that would crowd the first label gives way to it at that bucket. A candidate that
 * fits no bucket is `"none"`.
 *
 * @param strides - The candidates per stride, finest first, from {@link tickStrides}.
 * @param geometry - Each slot's position and estimated label width.
 * @returns Each candidate slot of the finest stride with its visibility, in slot order.
 */
export function thinTicks(
  strides: readonly Pick<TickStride, "slots">[],
  geometry: TickGeometry
): { readonly slot: number; readonly visibility: TickVisibility }[] {
  const finest = strides[0]?.slots ?? [];
  const first = finest[0];
  const shownFrom = new Map<number, number>();
  for (const [bucket, shown] of strideFits(strides, geometry)) {
    for (const slot of shown) {
      if (!shownFrom.has(slot)) shownFrom.set(slot, bucket);
    }
  }
  return finest.map((slot) => ({
    slot,
    visibility: slot === first ? "always" : (shownFrom.get(slot) ?? "none"),
  }));
}

/**
 * Whether some stride fits every bucket. When the interval's own strides fail a bucket, the axis
 * adds the strides of coarser calendar units.
 *
 * @param strides - The candidates per stride, finest first.
 * @param geometry - Each slot's position and estimated label width.
 * @returns True when every bucket picks a stride.
 */
export function fitsEveryBucket(
  strides: readonly Pick<TickStride, "slots">[],
  geometry: TickGeometry
): boolean {
  return strideFits(strides, geometry).size === TICK_BUCKETS.length;
}

/** Each bucket's shown slots, for the buckets where some stride fits. */
function strideFits(
  strides: readonly Pick<TickStride, "slots">[],
  geometry: TickGeometry
): Map<number, readonly number[]> {
  const first = strides[0]?.slots[0];
  const picks = new Map<number, readonly number[]>();
  let previous: ReadonlySet<number> | undefined;
  for (const bucket of TICK_BUCKETS) {
    // The first candidate always shows, so every stride is judged with it among its labels.
    let shown: readonly number[] | undefined;
    for (const { slots } of strides) {
      if (previous !== undefined && !holds(slots, previous)) continue;
      const labels = withFirst(slots, first, geometry, bucket);
      if (fits(labels, geometry, bucket)) {
        shown = labels;
        break;
      }
    }
    if (shown === undefined) continue;
    previous = new Set(shown.filter((slot) => slot !== first));
    picks.set(bucket, shown);
  }
  return picks;
}

/** Whether `slots` holds every slot of `previous`. */
function holds(slots: readonly number[], previous: ReadonlySet<number>): boolean {
  if (slots.length < previous.size) return false;
  const own = new Set(slots);
  for (const slot of previous) if (!own.has(slot)) return false;
  return true;
}
