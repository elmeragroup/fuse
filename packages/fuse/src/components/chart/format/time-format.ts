import { dateTimeFormat } from "../../../internal/intl-cache";
/**
 * Time labels for chart axes, tooltips, aria text and tables.
 * A slot is a period named by its start instant and interval. Every label reads that instant in an
 * explicit IANA zone, never the runtime's zone, so a server and a browser in any zones write the
 * same text. Fuse reads the zone rules through Intl and ships no zone database of its own.
 */
import { formatDateTime } from "../../../intl/date-time-join";
import type { SupportedLocale } from "../../../intl/locale-context";
import { makeFormattedText } from "./formatted-text";
import type { FormattedText, LabelRole } from "./formatted-text";
import { CHART_WORDS } from "./words";
import type { ChartWords } from "./words";

/**
 * The length of one period. `"second"` serves live power, whose feeds sample every few seconds.
 *
 * @beta
 */
export type Interval = "second" | "minute" | "quarter-hour" | "hour" | "day" | "week" | "month" | "year";

/**
 * A named time format. Each is a fixed recipe. The two range presets end at the wall-clock start
 * plus the interval, so the repeated fall-back hour reads `02–03` twice and the day ends at `24`.
 * `"time-seconds"` prints hours, minutes and seconds after CLDR's `Hms` pattern with a two-digit
 * hour, such as `13:42:04` in nb-NO and sv-SE, `13.42.04` in fi-FI and `1:42:04 PM` in en-US.
 *
 * @beta
 */
export type TimePreset =
  | "hour"
  | "hour-range"
  | "time"
  | "time-seconds"
  | "time-range"
  | "day"
  | "weekday"
  | "date"
  | "week"
  | "month"
  | "month-year"
  | "year";

/**
 * The one preset table: the interval each preset names, which is the slot a `Date` cell under it
 * reads. A preset whose interval is shorter than a day prints a time of day.
 */
export const PRESET_INTERVAL = {
  hour: "hour",
  "hour-range": "hour",
  time: "minute",
  "time-seconds": "second",
  "time-range": "quarter-hour",
  day: "day",
  weekday: "day",
  date: "day",
  week: "week",
  month: "month",
  "month-year": "month",
  year: "year",
} as const satisfies { readonly [P in TimePreset]: Interval };

/** The intervals shorter than a day. */
type ClockInterval = "second" | "minute" | "quarter-hour" | "hour";

/** The presets that print a time of day, whose interval is shorter than a day. */
export type ClockPreset = {
  readonly [P in TimePreset]: (typeof PRESET_INTERVAL)[P] extends ClockInterval ? P : never;
}[TimePreset];

const CLOCK_INTERVALS: ReadonlySet<Interval> = new Set<ClockInterval>([
  "second",
  "minute",
  "quarter-hour",
  "hour",
]);

/**
 * Whether a format is a preset that prints a time of day.
 *
 * @param format - A preset, or Intl date-time options.
 * @returns Whether it is a clock preset.
 */
export function isClockPreset(format: TimePreset | Intl.DateTimeFormatOptions): format is ClockPreset {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- an XFormat is a preset string or an options object
  return typeof format === "string" && CLOCK_INTERVALS.has(PRESET_INTERVAL[format]);
}

/** One period of a time axis. */
export type TimeSlot = {
  /** The period's start instant in epoch milliseconds. */
  readonly start: number;
  /** The period's length. */
  readonly interval: Interval;
};

/**
 * The preset a slot's tooltip, table and spoken label uses when no format overrides it, per
 * interval.
 */
export const LABEL_PRESETS = {
  second: "time-seconds",
  minute: "time",
  "quarter-hour": "time-range",
  hour: "hour-range",
  day: "date",
  week: "week",
  month: "month-year",
  year: "year",
} as const satisfies Record<Interval, TimePreset>;

/** The wall-clock fields of an instant in one zone. `hour` reaches 24 only at a range end. */
export type WallClock = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

const SECOND = 1_000;
const MINUTE = 60_000;
const DAY = 86_400_000;

/** The length of each sub-day interval in minutes. A range preset needs one of these. */
const RANGE_MINUTES = {
  second: undefined,
  minute: 1,
  "quarter-hour": 15,
  hour: 60,
  day: undefined,
  week: undefined,
  month: undefined,
  year: undefined,
} as const satisfies Record<Interval, number | undefined>;

/** The clocks' Intl recipes, read as UTC so no zone transition shifts the fields. */
const H12_HOUR = { hour: "numeric", hourCycle: "h12", timeZone: "UTC" } as const;
const H12_TIME = { hour: "numeric", minute: "2-digit", hourCycle: "h12", timeZone: "UTC" } as const;
const H12_SECONDS = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h12",
  timeZone: "UTC",
} as const;
const H23_TIME = { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" } as const;

const timeSeparators = new Map<SupportedLocale, string>();

/** The hour-minute separator of a 24-hour locale, such as `:` or `.`, as CLDR's `Hm` pattern writes it. */
function timeSeparator(locale: SupportedLocale): string {
  let separator = timeSeparators.get(locale);
  if (separator === undefined) {
    separator = part(dateTimeFormat(locale, H23_TIME).formatToParts(0), "literal");
    timeSeparators.set(locale, separator);
  }
  return separator;
}

/** Whether a clock time shows the hour alone, the hour and minute, or the seconds too. */
type Precision = "hour" | "minute" | "second";

/** The 12-hour clock's recipe for each precision. */
const H12_OPTIONS = { hour: H12_HOUR, minute: H12_TIME, second: H12_SECONDS } as const satisfies Record<
  Precision,
  Intl.DateTimeFormatOptions
>;

/** Intl recipes for the presets Intl formats directly, in visual and spoken form. */
const CALENDAR_OPTIONS = {
  day: [{ day: "numeric" }, { day: "numeric", month: "long" }],
  weekday: [{ weekday: "short" }, { weekday: "long" }],
  date: [
    { weekday: "long", day: "numeric", month: "long" },
    { weekday: "long", day: "numeric", month: "long" },
  ],
  month: [{ month: "short" }, { month: "long" }],
  "month-year": [
    { month: "long", year: "numeric" },
    { month: "long", year: "numeric" },
  ],
  year: [{ year: "numeric" }, { year: "numeric" }],
} as const satisfies Partial<
  Record<TimePreset, readonly [Intl.DateTimeFormatOptions, Intl.DateTimeFormatOptions]>
>;

function part(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((candidate) => candidate.type === type)?.value ?? "";
}

/**
 * A run of instants, `[from, to)`, over which a zone keeps one UTC offset, in milliseconds. Its
 * seconds stay, because some historic offsets have them, such as Monrovia's −00:44:30 until 1972.
 */
type OffsetSpan = { readonly from: number; readonly to: number; readonly offset: number };

/**
 * What Fuse has read of one zone: the Intl formatter that reads its wall clock, and the spans of
 * one offset it has read, sorted and disjoint. A zone changes its offset a few times a year, so
 * neighbouring days merge into a few spans per year, and a wall clock is the UTC fields of the
 * instant moved by its span's offset, with no Intl read.
 */
type ZoneOffsets = { readonly format: Intl.DateTimeFormat; readonly spans: OffsetSpan[] };

const zones = new Map<string, ZoneOffsets>();

function zoneOf(timeZone: string): ZoneOffsets {
  let zone = zones.get(timeZone);
  if (zone === undefined) {
    const format = dateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    });
    zone = { format, spans: [] };
    zones.set(timeZone, zone);
  }
  return zone;
}

/** The wall-clock fields Intl writes for an instant. */
function readWallClock(format: Intl.DateTimeFormat, instant: number): WallClock {
  const wall = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 };
  for (const { type, value } of format.formatToParts(instant)) {
    if (type === "year" || type === "month" || type === "day") wall[type] = Number(value);
    else if (type === "hour" || type === "minute" || type === "second") wall[type] = Number(value);
  }
  return wall;
}

/** The wall clock as if it were a UTC instant, which turns clock arithmetic into plain addition. */
function wallTime(wall: WallClock): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
}

/** The offset Intl reads at one instant. */
function readOffset(zone: ZoneOffsets, instant: number): number {
  return wallTime(readWallClock(zone.format, instant)) - Math.floor(instant / SECOND) * SECOND;
}

/** Add a span to a zone's sorted spans, merged with each neighbour it touches at the same offset. */
function learn(zone: ZoneOffsets, span: OffsetSpan): void {
  if (span.from >= span.to) return;
  const { spans } = zone;
  let index = 0;
  while (index < spans.length && (spans[index]?.from ?? 0) < span.from) index += 1;
  const before = spans[index - 1];
  const after = spans[index];
  const joinsBefore = before !== undefined && before.to === span.from && before.offset === span.offset;
  const joinsAfter = after !== undefined && after.from === span.to && after.offset === span.offset;
  const merged: OffsetSpan = {
    from: joinsBefore ? before.from : span.from,
    to: joinsAfter ? after.to : span.to,
    offset: span.offset,
  };
  spans.splice(joinsBefore ? index - 1 : index, Number(joinsBefore) + Number(joinsAfter), merged);
}

/**
 * Read the offsets of the UTC day that holds an instant: one Intl read at each end, and where the
 * two differ, a bisection to the second for the change between them.
 */
function learnDay(zone: ZoneOffsets, instant: number): number {
  const from = Math.floor(instant / DAY) * DAY;
  const to = from + DAY;
  const start = readOffset(zone, from);
  const end = readOffset(zone, to);
  if (start === end) {
    learn(zone, { from, to, offset: start });
    return start;
  }
  let before = from;
  let after = to;
  while (after - before > SECOND) {
    const middle = before + Math.floor((after - before) / (2 * SECOND)) * SECOND;
    if (readOffset(zone, middle) === start) before = middle;
    else after = middle;
  }
  learn(zone, { from, to: after, offset: start });
  learn(zone, { from: after, to, offset: end });
  return instant < after ? start : end;
}

/**
 * The zone's UTC offset at an instant, in milliseconds, from the span that holds it, or from the
 * day Fuse reads first. Each span holds what Intl reads for the zone, so no cache here depends on
 * the process's zone.
 */
function offsetAt(instant: number, timeZone: string): number {
  const zone = zoneOf(timeZone);
  const { spans } = zone;
  let low = 0;
  let high = spans.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((spans[middle]?.from ?? 0) <= instant) low = middle + 1;
    else high = middle;
  }
  const span = spans[low - 1];
  if (span !== undefined && instant < span.to) return span.offset;
  return learnDay(zone, instant);
}

/**
 * Read the wall clock of an instant in a zone: the UTC fields of the instant moved by the zone's
 * offset there.
 *
 * @param instant - The instant, epoch milliseconds.
 * @param timeZone - The IANA zone.
 * @returns The wall clock.
 * @throws A `RangeError` when `timeZone` is not an IANA zone.
 */
export function wallClock(instant: number, timeZone: string): WallClock {
  const local = new Date(instant + offsetAt(instant, timeZone));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

/**
 * Whether another instant shows the same wall clock, as both 02:00 hours of an Oslo fall-back day
 * do. The twin lies one offset change away, so each neighbouring day's offset names a candidate.
 * `wall` is the instant's own wall clock, which the label has read already.
 */
function isRepeatedWallTime(instant: number, timeZone: string, wall: WallClock): boolean {
  const own = wallTime(wall) - Math.floor(instant / SECOND) * SECOND;
  const local = Math.floor(instant / SECOND) * SECOND + own;
  return [instant - DAY, instant + DAY].some((probe) => {
    const other = offsetAt(probe, timeZone);
    return other !== own && offsetAt(local - other, timeZone) === other;
  });
}

/** Days since the Monday that starts a calendar date's ISO 8601 week, read from a UTC date. */
function daysSinceMonday(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/** ISO 8601 week number of a calendar date. The week belongs to the year of its Thursday. */
function isoWeek(wall: WallClock): number {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  date.setUTCDate(date.getUTCDate() - daysSinceMonday(date) + 3);
  return 1 + Math.floor((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY / 7);
}

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * A clock time in its visual form and in the full form the spoken text uses. Only the 12-hour
 * clock has a day period.
 */
type Clock = { readonly text: string; readonly full: string; readonly dayPeriod?: string };

/**
 * A wall-clock time in the locale's clock. The 24-hour locales pad both fields and write hour 24
 * as `24`, which Intl cannot write. The 12-hour locale formats the fields as a UTC instant, so no
 * zone transition can collapse them.
 */
function clock(locale: SupportedLocale, words: ChartWords, wall: WallClock, precision: Precision): Clock {
  switch (words.clock) {
    case "h23": {
      // CLDR's Hms joins the seconds with the Hm separator, and every field takes two digits.
      const separator = timeSeparator(locale);
      const text =
        precision === "hour"
          ? pad(wall.hour)
          : precision === "minute"
            ? `${pad(wall.hour)}${separator}${pad(wall.minute)}`
            : `${pad(wall.hour)}${separator}${pad(wall.minute)}${separator}${pad(wall.second)}`;
      return { text, full: text };
    }
    case "h12": {
      const parts = dateTimeFormat(locale, H12_OPTIONS[precision]).formatToParts(wallTime(wall));
      const text = parts
        .filter((candidate) => candidate.type !== "dayPeriod")
        .map((candidate) => candidate.value)
        .join("")
        .trimEnd();
      return {
        text,
        full: parts.map((candidate) => candidate.value).join(""),
        dayPeriod: part(parts, "dayPeriod"),
      };
    }
  }
}

/**
 * A range from the wall-clock start to the start plus the interval. The 12-hour locale applies
 * CLDR's English interval pattern, which writes the day period once when both ends share it.
 */
function range(
  locale: SupportedLocale,
  words: ChartWords,
  wall: WallClock,
  length: number,
  precision: Precision
): FormattedText {
  const endMinutes = wall.hour * 60 + wall.minute + length;
  const end = { ...wall, hour: Math.floor(endMinutes / 60), minute: endMinutes % 60 };
  const first = clock(locale, words, wall, precision);
  const last = clock(locale, words, end, precision);
  const start = first.dayPeriod === last.dayPeriod ? first.text : first.full;
  return makeFormattedText(
    `${start}${words.rangeSeparator}${last.full}`,
    words.spokenRange(first.full, last.full)
  );
}

function clockText(
  locale: SupportedLocale,
  words: ChartWords,
  interval: Interval,
  wall: WallClock,
  preset: ClockPreset
): FormattedText {
  const precision: Precision =
    preset === "time-seconds" ? "second" : preset === "time" || preset === "time-range" ? "minute" : "hour";
  if (preset === "hour" || preset === "time" || preset === "time-seconds") {
    const { full } = clock(locale, words, wall, precision);
    return makeFormattedText(full, words.spokenTime(full));
  }
  const length = RANGE_MINUTES[interval];
  if (length === undefined) {
    throw new RangeError(
      `The ${preset} preset needs a minute, quarter-hour or hour interval, not ${interval}`
    );
  }
  return range(locale, words, wall, length, precision);
}

function zoneName(
  locale: SupportedLocale,
  timeZone: string,
  instant: number,
  style: "short" | "long"
): string {
  return part(
    dateTimeFormat(locale, { timeZone, timeZoneName: style }).formatToParts(instant),
    "timeZoneName"
  );
}

/**
 * A clock label. A full label on a repeated fall-back hour appends the short zone name, and its
 * spoken text the long one, because the wall clock alone names two different hours.
 */
function clockLabel(
  locale: SupportedLocale,
  timeZone: string,
  slot: TimeSlot,
  preset: ClockPreset,
  role: LabelRole
): FormattedText {
  const wall = wallClock(slot.start, timeZone);
  const base = clockText(locale, CHART_WORDS[locale], slot.interval, wall, preset);
  if (role === "tick" || !isRepeatedWallTime(slot.start, timeZone, wall)) {
    return base;
  }
  return makeFormattedText(
    `${base.text} (${zoneName(locale, timeZone, slot.start, "short")})`,
    `${base.spoken}, ${zoneName(locale, timeZone, slot.start, "long")}`
  );
}

/**
 * Format one time slot for one locale.
 *
 * The 24-hour locales write `00–01` to `23–24`, and en-US writes `12 – 1 AM` to `11 PM – 12 AM`.
 * In a `full` label, a clock preset on a repeated fall-back hour appends the CLDR short zone name,
 * such as `02–03 (CEST)` and `02–03 (CET)`, and the spoken text appends the long name. A tick never
 * carries it. Weeks follow ISO 8601 in every locale.
 *
 * @param locale - The active supported locale.
 * @param timeZone - The IANA zone of the data's market, such as `"Europe/Oslo"`.
 * @param slot - The period's start and length.
 * @param preset - The format.
 * @param role - `tick` for the short axis form, `full` for tooltips, aria text and tables.
 * @returns The visual and spoken labels, with canonical spaces.
 * @throws {RangeError} When `timeZone` is not an IANA zone, a range preset gets a day or longer
 * interval. Each is a configuration defect.
 */
export function formatTime(
  locale: SupportedLocale,
  timeZone: string,
  slot: TimeSlot,
  preset: TimePreset,
  role: LabelRole
): FormattedText {
  switch (preset) {
    case "hour":
    case "hour-range":
    case "time":
    case "time-range":
    case "time-seconds":
      return clockLabel(locale, timeZone, slot, preset, role);
    case "week": {
      const words = CHART_WORDS[locale];
      const week = isoWeek(wallClock(slot.start, timeZone));
      return makeFormattedText(words.week(week), words.spokenWeek(week));
    }
    default: {
      const [visual, spoken] = CALENDAR_OPTIONS[preset];
      return makeFormattedText(
        dateTimeFormat(locale, { ...visual, timeZone }).format(slot.start),
        dateTimeFormat(locale, { ...spoken, timeZone }).format(slot.start)
      );
    }
  }
}

/** The length of each sub-day interval in milliseconds. */
const SUB_DAY_MS = {
  second: 1_000,
  minute: RANGE_MINUTES.minute * MINUTE,
  "quarter-hour": RANGE_MINUTES["quarter-hour"] * MINUTE,
  hour: RANGE_MINUTES.hour * MINUTE,
} as const;

/** The local calendar date of an instant in the zone, as the UTC milliseconds of that date's midnight. */
function localDate(instant: number, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  return Date.UTC(wall.year, wall.month - 1, wall.day);
}

/**
 * The earliest instant whose local date in the zone is `date`, as Temporal's
 * `ZonedDateTime#startOfDay` defines it. The offsets a day before and a day after give the two
 * candidate instants for local midnight. A repeated midnight keeps the earlier one. A midnight that
 * a gap skips has neither, so the start is the first instant after the gap, found to the second.
 */
function dayStart(date: number, timeZone: string): number {
  const candidates = [date - DAY, date + DAY].map((probe) => date - offsetAt(probe, timeZone));
  const exact = candidates.filter((candidate) => candidate + offsetAt(candidate, timeZone) === date);
  if (exact.length > 0) {
    return Math.min(...exact);
  }
  let before = Math.min(...candidates);
  let after = Math.max(...candidates);
  while (after - before > SECOND) {
    const middle = before + Math.floor((after - before) / (2 * SECOND)) * SECOND;
    if (localDate(middle, timeZone) >= date) {
      after = middle;
    } else {
      before = middle;
    }
  }
  return after;
}

/**
 * The start of the slot that contains `at`, read in the zone. A day, week, month or year starts at
 * the earliest instant of its first local date, and a week starts on Monday, per ISO 8601. A second,
 * minute, quarter-hour or hour slot steps its fixed length from the start of `at`'s local date, so
 * the last slot of a day whose length is not a multiple of it ends early at the next day's start.
 *
 * @param at - Any instant inside the slot, in epoch milliseconds.
 * @param interval - The slot length.
 * @param timeZone - The IANA zone of the data's market.
 * @returns The slot's start instant in epoch milliseconds.
 * @throws A `RangeError` when `timeZone` is not an IANA zone, a configuration defect.
 */
export function slotStart(at: number, interval: Interval, timeZone: string): number {
  const date = localDate(at, timeZone);
  switch (interval) {
    case "second":
    case "minute":
    case "quarter-hour":
    case "hour": {
      const start = dayStart(date, timeZone);
      const length = SUB_DAY_MS[interval];
      return start + Math.floor((at - start) / length) * length;
    }
    case "day":
      return dayStart(date, timeZone);
    case "week":
      return dayStart(date - daysSinceMonday(new Date(date)) * DAY, timeZone);
    case "month":
    case "year": {
      const first = new Date(date);
      first.setUTCDate(1);
      if (interval === "year") first.setUTCMonth(0);
      return dayStart(first.getTime(), timeZone);
    }
  }
}

/**
 * Format the slot that contains `at` with a preset or with Intl date options. Intl options write
 * one form, so their spoken text repeats the visual text. Options with date and time fields join
 * their halves through `formatDateTime`, so every engine writes the same join.
 *
 * @param locale - The active supported locale.
 * @param timeZone - The IANA zone of the data's market.
 * @param at - Any instant inside the slot, in epoch milliseconds.
 * @param interval - The slot length.
 * @param format - A preset, or Intl date options whose own zone `timeZone` replaces.
 * @param role - `tick` for the short axis form, `full` for tooltips, aria text and tables.
 * @returns The visual and spoken labels of the slot start, with canonical spaces.
 * @throws A `RangeError` when `timeZone` is not an IANA zone, a range preset gets a day or longer
 * interval.
 */
export function formatSlot(
  locale: SupportedLocale,
  timeZone: string,
  at: number,
  interval: Interval,
  format: TimePreset | Intl.DateTimeFormatOptions,
  role: LabelRole
): FormattedText {
  const start = slotStart(at, interval, timeZone);
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- consumer-owned union: a public XFormat is a preset string or Intl options of any prototype or realm
  if (typeof format === "string") {
    return formatTime(locale, timeZone, { start, interval }, format, role);
  }
  const text = formatDateTime(locale, { ...format, timeZone }, start);
  return makeFormattedText(text, text);
}

/**
 * Every slot start from `first` until `done` stops it, in one pass: a sub-day interval reads one
 * day start per local day and steps its fixed length inside it, so a 25-hour day lists 25 hours
 * and a 23.5-hour day ends its last hour early, as `nextSlotStart` steps them.
 *
 * @param first - A slot start, as `slotStart` returns it.
 * @param done - Whether a start lies past the run, which ends there.
 * @param interval - The slot length.
 * @param timeZone - The IANA zone of the data's market.
 * @returns The starts in order.
 */
export function slotStartsFrom(
  first: number,
  done: (start: number) => boolean,
  interval: Interval,
  timeZone: string
): number[] {
  const starts: number[] = [];
  let start = first;
  if (interval === "second" || interval === "minute" || interval === "quarter-hour" || interval === "hour") {
    const length = SUB_DAY_MS[interval];
    while (!done(start)) {
      const dayEnd = dayStart(localDate(start, timeZone) + DAY, timeZone);
      while (start < dayEnd && !done(start)) {
        starts.push(start);
        start = Math.min(start + length, dayEnd);
      }
    }
    return starts;
  }
  for (; !done(start); start = nextSlotStart(start, interval, timeZone)) starts.push(start);
  return starts;
}

/**
 * The start of the slot that follows the slot starting at `start`. A sub-day slot ends after its
 * fixed length or at the next day's start, whichever comes first, so a 25-hour day lists 25 hours
 * and a 23.5-hour day ends its last hour early. A longer slot ends at the start of its next local
 * day, ISO week, month or year.
 *
 * @param start - A slot start, as `slotStart` returns it.
 * @param interval - The slot length.
 * @param timeZone - The IANA zone of the data's market.
 * @returns The next slot's start instant in epoch milliseconds.
 */
export function nextSlotStart(start: number, interval: Interval, timeZone: string): number {
  const date = localDate(start, timeZone);
  switch (interval) {
    case "second":
    case "minute":
    case "quarter-hour":
    case "hour":
      return Math.min(start + SUB_DAY_MS[interval], dayStart(date + DAY, timeZone));
    case "day":
      return dayStart(date + DAY, timeZone);
    case "week":
      return dayStart(date + 7 * DAY, timeZone);
    case "month":
    case "year": {
      const next = new Date(date);
      next.setUTCDate(1);
      if (interval === "year") {
        next.setUTCMonth(0);
        next.setUTCFullYear(next.getUTCFullYear() + 1);
      } else {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }
      return dayStart(next.getTime(), timeZone);
    }
  }
}
