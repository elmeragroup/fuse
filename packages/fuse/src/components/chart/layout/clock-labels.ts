/**
 * The clock dial's labels. The tier is the cycle's sub-unit: hours round a day, weekdays round a
 * week, months round a year. An hour sits on its slot's start, and a weekday or a month centres on
 * its span, so on a 25-hour day "06" sits at 100.8°. Labels thin by stride, as the cartesian axis
 * thins them, over `tick-fit.ts`'s width buckets, but the fit is the dial's own: two neighbours fit
 * when the arc between them at the label radius holds half of each and the gap, and the pair that
 * meets across 12 o'clock is checked too. The cycle's first label always shows.
 */
import { wallTimes } from "../format/time-format";
import type { ClockCycle } from "./clock";
import { turnOf } from "./polar-angle";
import { LABEL_GAP, TICK_BUCKETS } from "./tick-fit";

/** The wall clock unit each cycle labels, and the strides it may thin to, finest first. */
const TIERS = {
  day: { unit: "hour", preset: "hour", strides: [1, 2, 3, 6] },
  week: { unit: "day", preset: "weekday", strides: [1] },
  year: { unit: "month", preset: "month", strides: [1, 2, 3, 6] },
} as const;

/** The label tier of a cycle: its wall clock unit, the preset that prints it, and its strides. */
export type ClockTier = (typeof TIERS)[ClockCycle];

/**
 * The label tier of a cycle.
 *
 * @param cycle - The dial's cycle.
 * @returns The tier.
 */
export function clockTier(cycle: ClockCycle): ClockTier {
  return TIERS[cycle];
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** A label's place before it is printed: its slot, its angle, its room and its unit's count. */
export type ClockLabelSlot = {
  /** The slot its unit starts at. */
  readonly slot: number;
  /** Its angle in degrees from 12 o'clock. */
  readonly angle: number;
  /** Its unit's place in the cycle: the hour of the day, the weekday from Monday or the month. */
  readonly unit: number;
};

/** A wall clock read as UTC, as `wallTimes` gives it. */
function wallDate(wall: number): Date {
  return new Date(wall);
}

/**
 * The wall-clock unit a wall clock falls in, as one ascending number: its hour, its day, or its
 * month. A slot starts a label when its unit differs from the slot before's, so a slot that starts at
 * :30 after a half-hour change, or a day that starts at 01:00, still labels its unit.
 */
function unitOf(wall: number, unit: ClockTier["unit"]): number {
  if (unit === "hour") return Math.floor(wall / HOUR);
  if (unit === "day") return Math.floor(wall / DAY);
  const date = wallDate(wall);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** A unit's place in its cycle: the hour, the weekday from Monday, or the month from January. */
function unitIndex(wall: number, unit: ClockTier["unit"]): number {
  const date = wallDate(wall);
  if (unit === "hour") return date.getUTCHours();
  if (unit === "day") return (date.getUTCDay() + 6) % 7;
  return date.getUTCMonth();
}

/**
 * Where a cycle's labels sit. A label's unit starts at the first slot whose wall clock falls in it,
 * so a repeated fall-back hour labels once and an hour that starts at :30 after a half-hour change
 * still labels. An hour sits on its slot's start, and a weekday or a
 * month in the middle of the slots it spans.
 *
 * @param starts - The cycle's slot starts, ascending.
 * @param timeZone - The IANA zone.
 * @param cycle - The dial's cycle.
 * @returns The labels in order.
 */
export function clockLabelSlots(
  starts: readonly number[],
  timeZone: string,
  cycle: ClockCycle
): ClockLabelSlot[] {
  const { unit } = TIERS[cycle];
  const walls = wallTimes(starts, timeZone);
  const count = starts.length;
  const firsts: number[] = [];
  let latest = Number.NEGATIVE_INFINITY;
  let current = Number.NEGATIVE_INFINITY;
  walls.forEach((wall, slot) => {
    // A repeated fall-back hour reads wall clocks already seen, so it labels once.
    if (wall <= latest) return;
    latest = wall;
    const at = unitOf(wall, unit);
    if (at > current) {
      current = at;
      firsts.push(slot);
    }
  });
  return firsts.map((slot, index) => {
    const step = 360 / count;
    const next = firsts[index + 1] ?? count;
    const angle = unit === "hour" ? slot * step : ((slot + next) / 2) * step;
    return { slot, angle, unit: unitIndex(walls[slot] ?? 0, unit) };
  });
}

/**
 * The narrowest container width, from `TICK_BUCKETS`, at which each label shows, `"always"` for the
 * cycle's first label and `"none"` for one no width shows. Each bucket takes the smallest stride
 * whose labels fit round the dial among the strides that divide the last bucket's, so a wider
 * bucket shows every label a narrower one does.
 *
 * @param labels - The labels in order.
 * @param widths - Each label's estimated width in CSS pixels.
 * @param cycle - The dial's cycle, whose tier gives the strides.
 * @param reach - The label radius as a share of the dial's radius.
 * @returns Each label's visibility.
 */
export function fitClockLabels(
  labels: readonly ClockLabelSlot[],
  widths: readonly number[],
  cycle: ClockCycle,
  reach: number
): (number | "always" | "none")[] {
  return fitStridedLabels(labels, widths, TIERS[cycle].strides, reach);
}

/** A label round a dial as the stride fit reads it: its angle, and its unit's count, which a stride divides. */
export type StridedLabel = {
  /** Its angle in degrees from 12 o'clock. */
  readonly angle: number;
  /** Its unit's count from the cycle's start, such as the hour of the day or the spoke's index. */
  readonly unit: number;
};

/**
 * The narrowest container width, from `TICK_BUCKETS`, at which each label round a dial shows,
 * `"always"` for the first label and `"none"` for one no width shows. Each bucket takes the
 * smallest stride whose labels fit round the dial among the strides that divide the last bucket's,
 * so a wider bucket shows every label a narrower one does.
 *
 * @param labels - The labels in order round the dial.
 * @param widths - Each label's estimated width in CSS pixels.
 * @param strides - The strides the labels may thin to, finest first.
 * @param reach - The label radius as a share of the dial's radius.
 * @returns Each label's visibility.
 */
export function fitStridedLabels(
  labels: readonly StridedLabel[],
  widths: readonly number[],
  strides: readonly number[],
  reach: number
): (number | "always" | "none")[] {
  const shownAt = labels.map((): number | "always" | "none" => "none");
  if (labels.length === 0) return shownAt;
  shownAt[0] = "always";
  // Each wider bucket keeps every label the narrower one showed, so its stride divides the last.
  let current: number | null = null;
  for (const bucket of TICK_BUCKETS) {
    const radius = (bucket / 2) * reach;
    const stride = strides.find(
      (candidate) =>
        (current === null || current % candidate === 0) && fits(labels, widths, candidate, radius)
    );
    if (stride === undefined) continue;
    current = stride;
    labels.forEach((label, index) => {
      if (shownAt[index] === "none" && label.unit % stride === 0) shownAt[index] = bucket;
    });
  }
  return shownAt;
}

/** Whether a stride's labels, the first always among them, fit round a dial at a label radius. */
function fits(
  labels: readonly StridedLabel[],
  widths: readonly number[],
  stride: number,
  radius: number
): boolean {
  const shown = labels.flatMap((label, index) =>
    index === 0 || label.unit % stride === 0 ? [{ angle: label.angle, width: widths[index] ?? 0 }] : []
  );
  if (shown.length < 2) return true;
  // Every neighbouring pair, and the pair that meets across 12 o'clock.
  return shown.every((label, index) => {
    const next = shown[(index + 1) % shown.length] ?? label;
    const apart = turnOf(next.angle - label.angle) || 360;
    const arc = (2 * Math.PI * radius * apart) / 360;
    return arc >= label.width / 2 + next.width / 2 + LABEL_GAP;
  });
}

/**
 * The slot PageUp or PageDown reaches: the slot holding the wall clock one label unit on, 6 hours
 * round a day, a day round a week and a month round a year, wrapping round the cycle.
 *
 * @param starts - The cycle's slot starts, ascending.
 * @param timeZone - The IANA zone.
 * @param cycle - The dial's cycle.
 * @param index - The slot to move from.
 * @param direction - 1 for PageDown, -1 for PageUp.
 * @returns The slot reached.
 */
export function pageSlot(
  starts: readonly number[],
  timeZone: string,
  cycle: ClockCycle,
  index: number,
  direction: 1 | -1
): number {
  const walls = wallTimes(starts, timeZone);
  const first = walls[0] ?? 0;
  const count = walls.length;
  const from = walls[index] ?? first;
  const length = cycleLength(first, cycle);
  let target: number;
  if (cycle === "year") {
    const date = wallDate(from);
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + direction;
    const last = new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate();
    target = Date.UTC(
      date.getUTCFullYear(),
      month,
      Math.min(day, last),
      date.getUTCHours(),
      date.getUTCMinutes()
    );
  } else target = from + direction * (cycle === "day" ? 6 * HOUR : DAY);
  // A target past either end wraps round the cycle.
  const wrapped = first + ((((target - first) % length) + length) % length);
  let slot = 0;
  for (let at = 0; at < count; at += 1) if ((walls[at] ?? 0) <= wrapped) slot = at;
  return slot;
}

/** The length of the cycle that starts at a wall clock, in wall clock milliseconds. */
function cycleLength(first: number, cycle: ClockCycle): number {
  if (cycle === "day") return DAY;
  if (cycle === "week") return 7 * DAY;
  const year = wallDate(first).getUTCFullYear();
  return Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1);
}
