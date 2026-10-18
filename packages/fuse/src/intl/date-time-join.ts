/**
 * A date-time that Fuse joins itself. Each engine's CLDR joins a date and a time in its own way.
 * Node 24 prints an en-US medium date-time as `Oct 18, 2026, 12:00 AM` where WebKit prints
 * `Oct 18, 2026 at 12:00 AM`, so a server-rendered label would fail hydration in Safari. Fuse
 * formats each half through Intl and joins them with CLDR 48's pattern, as it already owns the
 * range separator.
 */
import { dateTimeFormat } from "./intl-formatters";

/** The four lengths of a CLDR date-time join. */
type JoinLength = "full" | "long" | "medium" | "short";

/**
 * The text between the date and the time in CLDR 48's `dateTimeFormats-atTime` standard patterns,
 * which all take the form `{1}…{0}` with the date as `{1}` and the time as `{0}`. en writes
 * `{1} 'at' {0}` at full and long and `{1}, {0}` at medium and short. nb writes `{1} 'kl'. {0}`
 * and `{1}, {0}`, and sv writes `{1} 'kl'. {0}` and `{1} {0}`. fi writes `{1} 'klo' {0}` at every
 * length. A quoted run is literal text. Full and long share one separator in every language here,
 * and so do medium and short, so a mutant that swaps the two lengths of a pair prints the same
 * text and survives mutation testing by the data, not by a missing test.
 */
const AT_TIME_SEPARATORS = new Map<string, Readonly<Record<JoinLength, string>>>([
  ["en", { full: " at ", long: " at ", medium: ", ", short: ", " }],
  ["nb", { full: " kl. ", long: " kl. ", medium: ", ", short: ", " }],
  ["sv", { full: " kl. ", long: " kl. ", medium: " ", short: " " }],
  ["fi", { full: " klo ", long: " klo ", medium: " klo ", short: " klo " }],
]);

/** The options that ask for a date field. */
const DATE_FIELDS: ReadonlySet<string> = new Set(["dateStyle", "weekday", "era", "year", "month", "day"]);

/** The options that ask for a time field. */
const TIME_FIELDS: ReadonlySet<string> = new Set([
  "timeStyle",
  "hour",
  "minute",
  "second",
  "fractionalSecondDigits",
  "dayPeriod",
]);

/** The options whose keys pass `keep` and whose values are set. */
function half(
  options: Intl.DateTimeFormatOptions,
  keep: (key: string) => boolean
): Intl.DateTimeFormatOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([key, value]) => keep(key) && value !== undefined)
  );
}

/**
 * The join length UTS #35 picks from the date half. A `dateStyle` names it. Otherwise a wide month
 * with a weekday is full, a wide month alone is long, an abbreviated month is medium, and anything
 * else is short.
 */
function joinLength(date: Intl.DateTimeFormatOptions): JoinLength {
  if (date.dateStyle !== undefined) {
    return date.dateStyle;
  }
  if (date.month === "long") {
    return date.weekday === undefined ? "long" : "full";
  }
  return date.month === "short" ? "medium" : "short";
}

/**
 * Format an instant with Intl date-time options, joining a date half and a time half with
 * CLDR 48's pattern in en, nb, sv and fi. Options with only date fields or only time fields, a
 * weekday alone with a time, which CLDR prints through one skeleton, and every other language print
 * Intl's own output. The result keeps Intl's spaces, so a caller that
 * needs one string on every engine maps them with `canonicalSpaces`.
 *
 * @param locale - The BCP 47 locale.
 * @param options - The date and time format options, including any `timeZone`.
 * @param instant - The instant, in epoch milliseconds.
 * @returns The formatted date-time.
 * @throws {RangeError} When `options.timeZone` is not an IANA zone.
 * @throws {TypeError} When Intl rejects the options together, such as `dateStyle` beside `hour`.
 */
export function formatDateTime(locale: string, options: Intl.DateTimeFormatOptions, instant: number): string {
  const whole = dateTimeFormat(locale, options);
  // A zone name belongs to the time, and Intl rejects it beside `dateStyle`. The hour cycle only
  // shapes a time, so the date half ignores it.
  const date = half(options, (key) => !TIME_FIELDS.has(key) && key !== "timeZoneName");
  const time = half(options, (key) => !DATE_FIELDS.has(key));
  const separators = AT_TIME_SEPARATORS.get(new Intl.Locale(whole.resolvedOptions().locale).language);
  // CLDR 48 holds one skeleton for a weekday with a time, such as `Ehm`, so only a date half with
  // another field takes a join.
  const hasDate = Object.keys(date).some((key) => DATE_FIELDS.has(key) && key !== "weekday");
  const hasTime = Object.keys(time).some((key) => TIME_FIELDS.has(key));
  if (separators === undefined || !hasDate || !hasTime) {
    return whole.format(instant);
  }
  const dateText = dateTimeFormat(locale, date).format(instant);
  const timeText = dateTimeFormat(locale, time).format(instant);
  return `${dateText}${separators[joinLength(date)]}${timeText}`;
}
