/**
 * X-axis tick candidates, as CONTRACT section 8.11 defines them. Candidates sit on whole wall-clock
 * units, and `tick-fit.ts` picks the stride each width bucket shows. After the interval's own
 * strides come the strides of coarser calendar units, so a year of hours can fall back to month
 * starts.
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
