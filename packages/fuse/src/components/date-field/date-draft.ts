// What a date field shows while the user edits it: each editable segment's number, or `null` for a
// segment still showing its placeholder. A draft can hold what no Temporal value can, such as
// February 30 or a day typed before its month, so the field keeps the user's digits until they
// form a value, and the committed value stays separate from it. The rules are React Aria's
// `IncompleteDate` (`@react-stately/datepicker`), rewritten over Temporal:
//
// - The hour is held in the field's hour cycle, beside a day period, so AM/PM changes alone.
// - Arrow keys wrap a segment inside its limits. An empty segment takes the placeholder's value
//   first. The year and the minute and second round to the step, as React Aria does.
// - A ZonedDateTime's hour moves through real instants: in a DST overlap it visits the repeated hour
//   twice, in a gap it skips the missing one, and the held offset tells the repeated hours apart.
//
// Pure: no clock, no Intl. The placeholder value (today at midnight) comes from the caller, which
// reads the clock when the user acts, never while rendering.

import { temporal } from "../../temporal/temporal";
import type { DateGranularity, TemporalValue, ValueKind } from "../../temporal/temporal-value";

/** A segment the user edits. */
export type EditableSegmentType = "year" | "month" | "day" | "hour" | "dayPeriod" | "minute" | "second";

/** The hour cycles a field shows: 1–12 with a day period, or 0–23. */
export type HourCycle = "h12" | "h23";

/** A day period: `0` before noon, `1` from noon. */
export type DayPeriod = 0 | 1;

/** A field's edited numbers. `null` marks a segment showing its placeholder. */
export type DateDraft = {
  readonly year: number | null;
  readonly month: number | null;
  readonly day: number | null;
  /** The hour in the field's hour cycle: 1–12 under `h12`, 0–23 under `h23`. */
  readonly hour: number | null;
  /** The day period under `h12`; always `null` under `h23`. */
  readonly dayPeriod: DayPeriod | null;
  readonly minute: number | null;
  readonly second: number | null;
  /**
   * The UTC offset, in nanoseconds, of the zoned value the draft came from or an hour step landed
   * on. It picks between the two instants of a repeated wall-clock hour; any other edit drops it.
   */
  readonly offsetNanoseconds: number | null;
};

/** A draft with every segment showing its placeholder. */
export const EMPTY_DRAFT: DateDraft = {
  year: null,
  month: null,
  day: null,
  hour: null,
  dayPeriod: null,
  minute: null,
  second: null,
  offsetNanoseconds: null,
};

/** A segment's numeric range. */
type SegmentLimits = { readonly min: number; readonly max: number };

const ONE_HOUR_MS = 3_600_000;

/**
 * The segments a field edits, in React Aria's order: the date, then the time down to the
 * granularity, with the day period after the hour under a 12-hour cycle.
 *
 * @param granularity - The smallest unit edited.
 * @param hourCycle - The hour cycle shown.
 * @returns The editable segment types.
 */
export function editableSegments(granularity: DateGranularity, hourCycle: HourCycle): EditableSegmentType[] {
  const all: EditableSegmentType[] = [
    "year",
    "month",
    "day",
    "hour",
    ...(hourCycle === "h12" ? (["dayPeriod"] as const) : []),
    "minute",
    "second",
  ];
  const last =
    granularity === "day" ? "day" : granularity === "hour" && hourCycle === "h12" ? "dayPeriod" : granularity;
  return all.slice(0, all.indexOf(last) + 1);
}

/**
 * A segment's limits. The day runs to 31, the most any month holds, so a day typed before its
 * month is kept; committing constrains it.
 *
 * @param type - The segment.
 * @param hourCycle - The hour cycle shown.
 * @returns Its smallest and largest value.
 */
export function segmentLimits(type: EditableSegmentType, hourCycle: HourCycle): SegmentLimits {
  switch (type) {
    case "year":
      return { min: 1, max: 9999 };
    case "month":
      return { min: 1, max: 12 };
    case "day":
      return { min: 1, max: 31 };
    case "hour":
      return hourCycle === "h12" ? { min: 1, max: 12 } : { min: 0, max: 23 };
    case "dayPeriod":
      return { min: 0, max: 1 };
    case "minute":
    case "second":
      return { min: 0, max: 59 };
  }
}

/**
 * A 24-hour hour in an hour cycle.
 *
 * @param hour - The hour, 0–23.
 * @param hourCycle - The cycle.
 * @returns The day period (`null` under `h23`) and the hour in that cycle.
 */
export function toHourCycle(hour: number, hourCycle: HourCycle): readonly [DayPeriod | null, number] {
  if (hourCycle === "h23") {
    return [null, hour];
  }
  const dayPeriod: DayPeriod = hour >= 12 ? 1 : 0;
  const twelve = hour % 12;
  return [dayPeriod, twelve === 0 ? 12 : twelve];
}

/**
 * An hour in a cycle as a 24-hour hour.
 *
 * @param hour - The hour in the cycle: 1–12 under `h12`, 0–23 under `h23`.
 * @param dayPeriod - The day period, which only `h12` reads.
 * @param hourCycle - The cycle.
 * @returns The hour, 0–23.
 */
export function fromHourCycle(hour: number, dayPeriod: DayPeriod, hourCycle: HourCycle): number {
  if (hourCycle === "h23") {
    return hour;
  }
  return (hour === 12 ? 0 : hour) + (dayPeriod === 1 ? 12 : 0);
}

/**
 * The draft that shows a value: every segment filled from it, or every segment empty for `null`.
 *
 * @param value - The committed value, or `null`.
 * @param hourCycle - The hour cycle shown.
 * @returns The draft.
 */
export function draftOf(value: TemporalValue | null, hourCycle: HourCycle): DateDraft {
  if (value === null) {
    return EMPTY_DRAFT;
  }
  if (!("hour" in value)) {
    return { ...EMPTY_DRAFT, year: value.year, month: value.month, day: value.day };
  }
  const [dayPeriod, hour] = toHourCycle(value.hour, hourCycle);
  return {
    year: value.year,
    month: value.month,
    day: value.day,
    hour,
    dayPeriod,
    minute: value.minute,
    second: value.second,
    offsetNanoseconds: "offsetNanoseconds" in value ? value.offsetNanoseconds : null,
  };
}

/** Whether every one of `segments` holds a number. */
export function isComplete(draft: DateDraft, segments: readonly EditableSegmentType[]): boolean {
  return segments.every((segment) => draft[segment] !== null);
}

/** Whether every one of `segments` shows its placeholder. */
export function isCleared(draft: DateDraft, segments: readonly EditableSegmentType[]): boolean {
  return segments.every((segment) => draft[segment] === null);
}

/** The day period a placeholder's time falls in, for an hour typed into an empty field. */
function placeholderDayPeriod(placeholder: TemporalValue, hourCycle: HourCycle): DayPeriod | null {
  return "hour" in placeholder ? toHourCycle(placeholder.hour, hourCycle)[0] : null;
}

/**
 * The draft with one segment set, as typing sets it. An hour typed while the day period is empty
 * takes the placeholder's, and any edit but the second drops the held offset.
 *
 * @param draft - The draft.
 * @param type - The segment.
 * @param value - Its new number. It may lie outside what a value allows, such as day 31 in
 *   February; the draft keeps it until it commits.
 * @param placeholder - The value that fills empty segments, today at midnight.
 * @param hourCycle - The hour cycle shown.
 * @returns The new draft.
 */
export function setSegment(
  draft: DateDraft,
  type: EditableSegmentType,
  value: number,
  placeholder: TemporalValue,
  hourCycle: HourCycle
): DateDraft {
  const offsetNanoseconds = type === "second" ? draft.offsetNanoseconds : null;
  if (type === "dayPeriod") {
    return { ...draft, dayPeriod: asDayPeriod(value), offsetNanoseconds };
  }
  const dayPeriod =
    type === "hour" && draft.dayPeriod === null
      ? placeholderDayPeriod(placeholder, hourCycle)
      : draft.dayPeriod;
  return { ...draft, [type]: value, dayPeriod, offsetNanoseconds };
}

function asDayPeriod(value: number): DayPeriod {
  return value === 1 ? 1 : 0;
}

/**
 * The draft with one segment back on its placeholder.
 *
 * @param draft - The draft.
 * @param type - The segment.
 * @returns The new draft, without a held offset.
 */
export function clearSegment(draft: DateDraft, type: EditableSegmentType): DateDraft {
  return { ...draft, [type]: null, offsetNanoseconds: null };
}

/**
 * `value + amount`, wrapping inside `min..max`. Rounded, it first steps one and then snaps to the
 * next multiple of `amount` in the step's direction, so 2026 pages up by five to 2030.
 */
function cycleValue(value: number, amount: number, min: number, max: number, round: boolean): number {
  if (!round) {
    const next = value + amount;
    if (next < min) {
      return max - (min - next - 1);
    }
    return next > max ? min + (next - max - 1) : next;
  }
  let next = value + Math.sign(amount);
  if (next < min) {
    next = max;
  }
  const step = Math.abs(amount);
  next = amount > 0 ? Math.ceil(next / step) * step : Math.floor(next / step) * step;
  return next > max ? min : next;
}

/**
 * The draft with one segment stepped by `amount`, wrapping at its limits: an arrow key steps by
 * one, Page Up and Page Down by the segment's page. An empty segment takes the placeholder's value
 * instead, except the day period, which steps from AM.
 *
 * @param draft - The draft.
 * @param type - The segment.
 * @param amount - The step, negative to go down.
 * @param placeholder - The value that fills empty segments, today at midnight in the field's zone.
 * @param hourCycle - The hour cycle shown.
 * @returns The new draft.
 */
export function cycleSegment(
  draft: DateDraft,
  type: EditableSegmentType,
  amount: number,
  placeholder: TemporalValue,
  hourCycle: HourCycle
): DateDraft {
  if (draft[type] === null && type !== "dayPeriod") {
    return fillFromPlaceholder(draft, type, placeholder, hourCycle);
  }
  if (type === "hour") {
    return cycleHour(draft, amount, placeholder, hourCycle);
  }
  const { min, max } = segmentLimits(type, hourCycle);
  // An empty day period steps from AM, its minimum; every other segment is filled here.
  const next = cycleValue(draft[type] ?? min, amount, min, max, ROUNDED_SEGMENTS.has(type));
  return type === "dayPeriod" ? { ...draft, dayPeriod: asDayPeriod(next) } : { ...draft, [type]: next };
}

/** The segments whose page step lands on a multiple of the step, as React Aria's `cycleValue` rounds. */
const ROUNDED_SEGMENTS: ReadonlySet<EditableSegmentType> = new Set(["year", "minute", "second"]);

/** A placeholder's number for a segment; a PlainDate's time reads as midnight. */
function placeholderField(
  placeholder: TemporalValue,
  type: "year" | "month" | "day" | "minute" | "second"
): number {
  if (type === "minute" || type === "second") {
    return "hour" in placeholder ? placeholder[type] : 0;
  }
  return placeholder[type];
}

function fillFromPlaceholder(
  draft: DateDraft,
  type: Exclude<EditableSegmentType, "dayPeriod">,
  placeholder: TemporalValue,
  hourCycle: HourCycle
): DateDraft {
  if (type === "hour") {
    const [dayPeriod, hour] = toHourCycle("hour" in placeholder ? placeholder.hour : 0, hourCycle);
    return { ...draft, hour, dayPeriod };
  }
  return { ...draft, [type]: placeholderField(placeholder, type) };
}

function cycleHour(
  draft: DateDraft,
  amount: number,
  placeholder: TemporalValue,
  hourCycle: HourCycle
): DateDraft {
  // A zoned field whose date is whole steps through real instants, so DST is honoured.
  if ("timeZoneId" in placeholder && draft.year !== null && draft.month !== null && draft.day !== null) {
    const zoned = draftToValue(draft, placeholder, hourCycle);
    if ("timeZoneId" in zoned) {
      const cycled = cycleZonedHour(zoned, amount, hourCycle);
      const [dayPeriod, hour] = toHourCycle(cycled.hour, hourCycle);
      return { ...draft, hour, dayPeriod, offsetNanoseconds: cycled.offsetNanoseconds };
    }
  }
  const limits = segmentLimits("hour", hourCycle);
  return {
    ...draft,
    hour: cycleValue(draft.hour ?? 0, amount, limits.min, limits.max, false),
    dayPeriod: draft.dayPeriod ?? placeholderDayPeriod(placeholder, hourCycle),
  };
}

/** The instant of `wallClock` in `zone` that stays on its own day, earliest or latest. */
function instantOnDay(
  wallClock: Temporal.PlainDateTime,
  zone: string,
  pick: "first" | "last"
): Temporal.ZonedDateTime | undefined {
  const candidates = (["earlier", "later"] as const)
    .map((disambiguation) => wallClock.toZonedDateTime(zone, { disambiguation }))
    .filter((candidate) => candidate.day === wallClock.day);
  return pick === "first" ? candidates[0] : candidates.at(-1);
}

/**
 * A zoned value's hour stepped through the day's real hours, as `@internationalized/date`'s
 * `cycleZoned` does: the step counts whole hours since the epoch, wrapping between the day's first
 * and last hour (that half of the day under a 12-hour cycle), so a repeated hour is visited twice
 * and a skipped hour never.
 *
 * @param value - The value.
 * @param amount - Hours to step, negative to go back.
 * @param hourCycle - The hour cycle shown.
 * @returns The value at the stepped instant, in its zone.
 */
function cycleZonedHour(
  value: Temporal.ZonedDateTime,
  amount: number,
  hourCycle: HourCycle
): Temporal.ZonedDateTime {
  const afternoon = value.hour >= 12;
  const minHour = hourCycle === "h12" && afternoon ? 12 : 0;
  const maxHour = hourCycle === "h12" && !afternoon ? 11 : 23;
  const wallClock = value.toPlainDateTime();
  const first = instantOnDay(wallClock.with({ hour: minHour }), value.timeZoneId, "first") ?? value;
  const last = instantOnDay(wallClock.with({ hour: maxHour }), value.timeZoneId, "last") ?? value;
  const epoch = value.epochMilliseconds;
  const hours = Math.floor(epoch / ONE_HOUR_MS);
  const remainder = epoch - hours * ONE_HOUR_MS;
  const stepped = cycleValue(
    hours,
    amount,
    Math.floor(first.epochMilliseconds / ONE_HOUR_MS),
    Math.floor(last.epochMilliseconds / ONE_HOUR_MS),
    false
  );
  return temporal()
    .Instant.fromEpochMilliseconds(stepped * ONE_HOUR_MS + remainder)
    .toZonedDateTimeISO(value.timeZoneId);
}

/**
 * The value a draft makes: its segments over `base`, which fills the empty ones and gives the
 * kind, zone and sub-second fields. Fields a value cannot hold are constrained, so February 30
 * becomes February 28 or 29; under a 12-hour cycle an empty hour reads as the start of its day
 * period. A zoned value keeps the draft's offset when it is one of that wall clock's offsets.
 *
 * @param draft - The draft.
 * @param base - The committed value, or the placeholder when there is none.
 * @param hourCycle - The hour cycle shown.
 * @returns The value, of `base`'s kind.
 */
export function draftToValue(draft: DateDraft, base: TemporalValue, hourCycle: HourCycle): TemporalValue {
  const runtime = temporal();
  // A lone typed zero, the first digit of 01–09, is below every limit; it reads as the limit, as
  // React Aria's constrain does, while the draft keeps showing it.
  const date = {
    year: Math.max(1, draft.year ?? base.year),
    month: Math.max(1, draft.month ?? base.month),
    day: Math.max(1, draft.day ?? base.day),
  };
  if (!("hour" in base)) {
    return runtime.PlainDate.from(date, { overflow: "constrain" });
  }
  // Under `h12` an empty hour reads as the day period's first, 12.
  const hour =
    hourCycle === "h12" || draft.hour !== null
      ? fromHourCycle(draft.hour ?? 12, draft.dayPeriod ?? 0, hourCycle)
      : base.hour;
  const wallClock = runtime.PlainDateTime.from(
    {
      ...date,
      hour,
      minute: draft.minute ?? base.minute,
      second: draft.second ?? base.second,
      millisecond: base.millisecond,
      microsecond: base.microsecond,
      nanosecond: base.nanosecond,
    },
    { overflow: "constrain" }
  );
  if (!("timeZoneId" in base)) {
    return wallClock;
  }
  const compatible = wallClock.toZonedDateTime(base.timeZoneId, { disambiguation: "compatible" });
  if (draft.offsetNanoseconds === null || compatible.offsetNanoseconds === draft.offsetNanoseconds) {
    return compatible;
  }
  return (
    (["earlier", "later"] as const)
      .map((disambiguation) => wallClock.toZonedDateTime(base.timeZoneId, { disambiguation }))
      .find((candidate) => candidate.offsetNanoseconds === draft.offsetNanoseconds) ?? compatible
  );
}

/**
 * Whether a value shows exactly the draft's segments, so committing it changes nothing the user
 * typed. February 30 constrained to February 28 does not.
 *
 * @param draft - The draft.
 * @param value - The value it made.
 * @param segments - The segments the field shows.
 * @param hourCycle - The hour cycle shown.
 * @returns Whether every shown segment matches.
 */
export function roundTrips(
  draft: DateDraft,
  value: TemporalValue,
  segments: readonly EditableSegmentType[],
  hourCycle: HourCycle
): boolean {
  return segments.every((segment) => {
    if (segment === "hour" || segment === "dayPeriod") {
      if (!("hour" in value)) {
        return false;
      }
      const [dayPeriod, hour] = toHourCycle(value.hour, hourCycle);
      return draft.hour === hour && draft.dayPeriod === dayPeriod;
    }
    if (segment === "minute" || segment === "second") {
      return "hour" in value && draft[segment] === value[segment];
    }
    return draft[segment] === value[segment];
  });
}

/**
 * The value that fills an empty field's segments: today at midnight, of the field's kind.
 *
 * @param today - Today's date in the field's zone, read when the user acts.
 * @param kind - The field's value kind.
 * @returns The placeholder value.
 */
export function placeholderValue(today: Temporal.PlainDate, kind: ValueKind): TemporalValue {
  switch (kind.kind) {
    case "PlainDate":
      return today;
    case "PlainDateTime":
      return today.toPlainDateTime();
    case "ZonedDateTime":
      return today.toZonedDateTime({ timeZone: kind.timeZone });
  }
}
