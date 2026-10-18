/**
 * Time labels for chart axes, tooltips, aria text and tables.
 * A slot is a period named by its start instant and interval. Every label reads that instant in an
 * explicit IANA zone, never the runtime's zone, so a server and a browser in any zones write the
 * same text. Fuse reads the zone rules through Intl and ships no zone database of its own.
 */
import { dateTimeFormat } from "../../../intl/intl-formatters";
import type { SupportedLocale } from "../../../intl/locale-context";
import { makeFormattedText } from "./formatted-text";
import type { FormattedText, LabelRole } from "./formatted-text";
import { CHART_WORDS } from "./words";
import type { ChartWords } from "./words";

/** The length of one period. */
export type Interval = "minute" | "quarter-hour" | "hour" | "day" | "week" | "month" | "year";

/**
 * A named time format. Each is a fixed recipe. The two range presets end at the wall-clock start
 * plus the interval, so the repeated fall-back hour reads `02–03` twice and the day ends at `24`.
 */
export type TimePreset =
  | "hour"
  | "hour-range"
  | "time"
  | "time-range"
  | "day"
  | "weekday"
  | "date"
  | "week"
  | "month"
  | "month-year"
  | "year";

/** One period of a time axis. */
export type TimeSlot = {
  /** The period's start instant in epoch milliseconds. */
  readonly start: number;
  /** The period's length. */
  readonly interval: Interval;
};

/** The wall-clock fields of an instant in one zone. `hour` reaches 24 only at a range end. */
type WallClock = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
};

const MINUTE = 60_000;
const DAY = 86_400_000;

/** The length of each sub-day interval in minutes. A range preset needs one of these. */
const RANGE_MINUTES = {
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
const H23_TIME = { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" } as const;

/** The hour-minute separator of a 24-hour locale, such as `:` or `.`, as CLDR's `Hm` pattern writes it. */
function timeSeparator(locale: SupportedLocale): string {
  return part(dateTimeFormat(locale, H23_TIME).formatToParts(0), "literal");
}

/** Whether a clock time shows the hour alone or the hour and minute. */
type Precision = "hour" | "minute";

/** The 12-hour clock's recipe for each precision. */
const H12_OPTIONS = { hour: H12_HOUR, minute: H12_TIME } as const satisfies Record<
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

/** Read the wall clock of an instant in a zone through Intl. */
function wallClock(instant: number, timeZone: string): WallClock {
  const parts = dateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(instant);
  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day")),
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
  };
}

/** The wall clock as if it were a UTC instant, which turns clock arithmetic into plain addition. */
function wallTime(wall: WallClock): number {
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
}

/** The zone's UTC offset at an instant, in minutes. */
function offsetMinutes(instant: number, timeZone: string): number {
  return (wallTime(wallClock(instant, timeZone)) - Math.floor(instant / MINUTE) * MINUTE) / MINUTE;
}

/**
 * Whether another instant shows the same wall clock, as both 02:00 hours of an Oslo fall-back day
 * do. The twin lies one offset change away, so each neighbouring day's offset names a candidate.
 */
function isRepeatedWallTime(instant: number, timeZone: string): boolean {
  const own = offsetMinutes(instant, timeZone);
  const wall = Math.floor(instant / MINUTE) * MINUTE + own * MINUTE;
  return [instant - DAY, instant + DAY].some((probe) => {
    const other = offsetMinutes(probe, timeZone);
    return other !== own && offsetMinutes(wall - other * MINUTE, timeZone) === other;
  });
}

/** ISO 8601 week number of a calendar date. The week belongs to the year of its Thursday. */
function isoWeek(wall: WallClock): number {
  const date = new Date(Date.UTC(wall.year, wall.month - 1, wall.day));
  const mondayBased = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayBased + 3);
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
      const text =
        precision === "minute"
          ? `${pad(wall.hour)}${timeSeparator(locale)}${pad(wall.minute)}`
          : pad(wall.hour);
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

type ClockPreset = "hour" | "hour-range" | "time" | "time-range";

function clockText(
  locale: SupportedLocale,
  words: ChartWords,
  interval: Interval,
  wall: WallClock,
  preset: ClockPreset
): FormattedText {
  const precision: Precision = preset === "time" || preset === "time-range" ? "minute" : "hour";
  if (preset === "hour" || preset === "time") {
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
  const base = clockText(locale, CHART_WORDS[locale], slot.interval, wallClock(slot.start, timeZone), preset);
  if (role === "tick" || !isRepeatedWallTime(slot.start, timeZone)) {
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
 * @throws {RangeError} When `timeZone` is not an IANA zone, or a range preset gets a day or longer
 * interval. Both are configuration defects.
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
