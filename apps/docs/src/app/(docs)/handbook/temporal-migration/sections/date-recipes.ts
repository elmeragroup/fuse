/**
 * The `@internationalized/date` → Temporal recipes the migration guide's table prints.
 *
 * Every Temporal cell is a JavaScript expression, printed as written and evaluated as written by
 * `test/temporal-recipes.test.ts`, which holds a literal expectation for each recipe and kind. So
 * a recipe that calls a method a kind lacks, or drops a time it should keep, fails that test
 * rather than a reader's build. Expressions read these names, which the test defines:
 *
 * - `date`, `a`, `b`: values of the row's kind, which standalone recipes never read (`a` before `b`, on the same day for date-times);
 * - `tz`: an IANA zone; `locale`: a Fuse locale;
 * - `firstDay`: the locale's first weekday as an ISO weekday (Monday 1 … Sunday 7);
 * - `time`: a `Temporal.PlainTime`; `jsDate`: a `Date`.
 *
 * Notes may wrap code in backticks; the table renders those spans as code.
 */

/** The value kinds Fuse's date components hold. */
export type DateKind = "PlainDate" | "PlainDateTime" | "ZonedDateTime";

export const DATE_KINDS: readonly DateKind[] = ["PlainDate", "PlainDateTime", "ZonedDateTime"];

/**
 * A recipe's Temporal side: a standalone expression that reads no value (a constructor, a parser,
 * the clock); one expression of the row's value for every kind; or one per kind it applies to.
 */
export type RecipeCode =
  | { readonly kind: "standalone"; readonly code: string }
  | { readonly kind: "any"; readonly code: string }
  | { readonly kind: "per-kind"; readonly code: Readonly<Partial<Record<DateKind, string>>> }
  | { readonly kind: "none"; readonly text: string };

export type DateRecipe = {
  /** Stable key, which the test's expectations are keyed by. */
  readonly id: string;
  /** The `@internationalized/date` code it replaces. */
  readonly from: string;
  readonly temporal: RecipeCode;
  readonly note?: string;
};

function standalone(code: string): RecipeCode {
  return { kind: "standalone", code };
}

function any(code: string): RecipeCode {
  return { kind: "any", code };
}

function perKind(code: Partial<Record<DateKind, string>>): RecipeCode {
  return { kind: "per-kind", code };
}

const FORMAT_DATE_TIME = 'date.toLocaleString(locale, { dateStyle: "long", timeStyle: "short" })';

export const DATE_RECIPES: readonly DateRecipe[] = [
  {
    id: "new-calendar-date",
    from: "new CalendarDate(2026, 10, 5)",
    temporal: standalone("new Temporal.PlainDate(2026, 10, 5)"),
    note: "Months are 1-based in both.",
  },
  {
    id: "new-calendar-date-time",
    from: "new CalendarDateTime(2026, 10, 5, 9, 30)",
    temporal: standalone("new Temporal.PlainDateTime(2026, 10, 5, 9, 30)"),
  },
  {
    id: "new-zoned-date-time",
    from: 'new ZonedDateTime(2026, 10, 5, "Europe/Oslo", 7200000, 9, 30)',
    temporal: standalone(
      'Temporal.ZonedDateTime.from({ year: 2026, month: 10, day: 5, hour: 9, minute: 30, timeZone: "Europe/Oslo" })'
    ),
    note: "Temporal works out the offset from the zone.",
  },
  { id: "new-time", from: "new Time(9, 30)", temporal: standalone("new Temporal.PlainTime(9, 30)") },
  {
    id: "parse-date",
    from: 'parseDate("2026-10-05")',
    temporal: standalone('Temporal.PlainDate.from("2026-10-05")'),
  },
  {
    id: "parse-date-time",
    from: 'parseDateTime("2026-10-05T09:30")',
    temporal: standalone('Temporal.PlainDateTime.from("2026-10-05T09:30")'),
  },
  {
    id: "parse-zoned-date-time",
    from: 'parseZonedDateTime("2026-10-05T09:30[Europe/Oslo]")',
    temporal: standalone('Temporal.ZonedDateTime.from("2026-10-05T09:30[Europe/Oslo]")'),
  },
  {
    id: "parse-absolute",
    from: 'parseAbsolute("2026-10-05T07:30Z", tz)',
    temporal: standalone('Temporal.Instant.from("2026-10-05T07:30Z").toZonedDateTimeISO(tz)'),
  },
  { id: "parse-time", from: 'parseTime("09:30")', temporal: standalone('Temporal.PlainTime.from("09:30")') },
  {
    id: "today",
    from: "today(tz)",
    temporal: standalone(
      "Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(tz).toPlainDate()"
    ),
    note: "Read it in an effect or an event handler, never while rendering, as Fuse's calendars do. It reads `Date.now()`, as Fuse does, so a test that fakes `Date` fakes today too; native `Temporal.Now.plainDateISO(tz)` gives the same date but ignores a faked `Date`.",
  },
  {
    id: "now",
    from: "now(tz)",
    temporal: standalone("Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(tz)"),
    note: "As `today`: `Date.now()` follows a faked clock, where native `Temporal.Now.zonedDateTimeISO(tz)` does not.",
  },
  {
    id: "local-time-zone",
    from: "getLocalTimeZone()",
    temporal: standalone("Temporal.Now.timeZoneId()"),
    note: "Prefer the zone of the market your data describes, as `LocaleProvider`'s `timeZone`.",
  },
  {
    id: "set",
    from: "date.set({ day: 1 })",
    temporal: any("date.with({ day: 1 })"),
    note: "Keeps the time and zone.",
  },
  {
    id: "add",
    from: 'parseDate("2026-01-31").add({ months: 1 })',
    temporal: standalone('Temporal.PlainDate.from("2026-01-31").add({ months: 1 })'),
    note: '`add` and `subtract` keep their names, and both clamp to the month\'s last day. Pass `{ overflow: "reject" }` to throw instead.',
  },
  {
    id: "cycle",
    from: "date.cycle(field, n)",
    temporal: { kind: "none", text: "No equivalent" },
    note: "Fuse's segments cycle on their own; elsewhere compute the field with `with` and modular arithmetic.",
  },
  {
    id: "compare",
    from: "a.compare(b)",
    temporal: perKind({
      PlainDate: "Temporal.PlainDate.compare(a, b)",
      PlainDateTime: "Temporal.PlainDateTime.compare(a, b)",
      ZonedDateTime: "Temporal.ZonedDateTime.compare(a, b)",
    }),
    note: "Use the static `compare` of the values' own kind: `PlainDate.compare` on two date-times converts them to dates and drops the time. Only the sign carries over, since React Aria returns the difference (−2) where Temporal returns −1, 0 or 1. Zoned values compare as instants.",
  },
  {
    id: "same-day",
    from: "isSameDay(a, b)",
    temporal: perKind({
      PlainDate: "a.equals(b)",
      PlainDateTime: "a.toPlainDate().equals(b.toPlainDate())",
      ZonedDateTime: "a.toPlainDate().equals(b.toPlainDate())",
    }),
    note: "Compares each value's own wall-clock date, as React Aria does. `isEqualDay` is the same in the ISO calendar.",
  },
  {
    id: "same-month",
    from: "isSameMonth(a, b)",
    temporal: perKind({
      PlainDate: "a.toPlainYearMonth().equals(b.toPlainYearMonth())",
      PlainDateTime: "a.toPlainDate().toPlainYearMonth().equals(b.toPlainDate().toPlainYearMonth())",
      ZonedDateTime: "a.toPlainDate().toPlainYearMonth().equals(b.toPlainDate().toPlainYearMonth())",
    }),
    note: "Only `PlainDate` has `toPlainYearMonth()`.",
  },
  { id: "same-year", from: "isSameYear(a, b)", temporal: any("a.year === b.year") },
  {
    id: "is-today",
    from: "isToday(date, tz)",
    temporal: perKind({
      PlainDate:
        "date.equals(Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(tz).toPlainDate())",
      PlainDateTime:
        "date.toPlainDate().equals(Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(tz).toPlainDate())",
      ZonedDateTime:
        "date.toPlainDate().equals(Temporal.Instant.fromEpochMilliseconds(Date.now()).toZonedDateTimeISO(tz).toPlainDate())",
    }),
    note: "Compares the value's own wall-clock date with today in `tz`, read as the `today` recipe reads it, as React Aria does. To ask about `tz`'s day for a zoned value, convert it first with `withTimeZone(tz)`.",
  },
  {
    id: "start-of-month",
    from: "startOfMonth(date)",
    temporal: any("date.with({ day: 1 })"),
    note: "Keeps the time, as React Aria does.",
  },
  { id: "end-of-month", from: "endOfMonth(date)", temporal: any("date.with({ day: date.daysInMonth })") },
  { id: "start-of-year", from: "startOfYear(date)", temporal: any("date.with({ month: 1, day: 1 })") },
  { id: "end-of-year", from: "endOfYear(date)", temporal: any("date.with({ month: 12, day: 31 })") },
  {
    id: "day-of-week",
    from: "getDayOfWeek(date, locale)",
    temporal: any("(date.dayOfWeek - firstDay + 7) % 7"),
    note: "React Aria counts 0–6 from the locale's first day: Monday is 1 in en-US and 0 in nb-NO. Temporal's `dayOfWeek` is ISO, Monday 1 to Sunday 7 in every locale. `firstDay` is 7 for en-US and 1 for nb-NO, sv-SE and fi-FI.",
  },
  {
    id: "start-of-week",
    from: "startOfWeek(date, locale)",
    temporal: any("date.subtract({ days: (date.dayOfWeek - firstDay + 7) % 7 })"),
  },
  {
    id: "end-of-week",
    from: "endOfWeek(date, locale)",
    temporal: any("date.add({ days: 6 - ((date.dayOfWeek - firstDay + 7) % 7) })"),
  },
  {
    id: "is-weekend",
    from: "isWeekend(date, locale)",
    temporal: any("date.dayOfWeek >= 6"),
    note: "Saturday and Sunday in all four Fuse locales. `Intl.Locale#getWeekInfo` is not in every engine.",
  },
  {
    id: "to-calendar-date",
    from: "toCalendarDate(date)",
    temporal: perKind({
      PlainDate: "date",
      PlainDateTime: "date.toPlainDate()",
      ZonedDateTime: "date.toPlainDate()",
    }),
  },
  {
    id: "to-calendar-date-time",
    from: "toCalendarDateTime(date, time)",
    temporal: perKind({
      PlainDate: "date.toPlainDateTime(time)",
      PlainDateTime: "date.withPlainTime(time)",
      ZonedDateTime: "date.toPlainDateTime().withPlainTime(time)",
    }),
    note: "Without `time`: midnight for a date (`date.toPlainDateTime()`), the value itself for a date-time, `date.toPlainDateTime()` for a zoned value.",
  },
  {
    id: "to-time",
    from: "toTime(date)",
    temporal: perKind({ PlainDateTime: "date.toPlainTime()", ZonedDateTime: "date.toPlainTime()" }),
  },
  {
    id: "to-zoned",
    from: "toZoned(date, tz)",
    temporal: perKind({
      PlainDate: "date.toZonedDateTime(tz)",
      PlainDateTime: "date.toZonedDateTime(tz)",
      ZonedDateTime: "date.withTimeZone(tz)",
    }),
    note: 'A date starts at its first instant in `tz`. Both libraries resolve a wall-clock time in a DST gap or overlap as `"compatible"`.',
  },
  {
    id: "to-zoned-dst-gap",
    from: 'toZoned(parseDateTime("2026-03-29T02:30"), "Europe/Oslo")',
    temporal: standalone('Temporal.PlainDateTime.from("2026-03-29T02:30").toZonedDateTime("Europe/Oslo")'),
    note: "02:30 never happened in Oslo that night; both move it an hour on.",
  },
  {
    id: "to-time-zone",
    from: "toTimeZone(date, tz)",
    temporal: perKind({ ZonedDateTime: "date.withTimeZone(tz)" }),
    note: "The same instant on `tz`'s wall clock.",
  },
  {
    id: "to-date",
    from: "date.toDate(tz)",
    temporal: perKind({
      PlainDate: "new Date(date.toZonedDateTime(tz).epochMilliseconds)",
      PlainDateTime: "new Date(date.toZonedDateTime(tz).epochMilliseconds)",
      ZonedDateTime: "new Date(date.epochMilliseconds)",
    }),
    note: "A zoned value already names its instant, so it needs no `tz`.",
  },
  {
    id: "from-date",
    from: "fromDate(jsDate, tz)",
    temporal: standalone("Temporal.Instant.fromEpochMilliseconds(jsDate.getTime()).toZonedDateTimeISO(tz)"),
  },
  {
    id: "format",
    from: "new DateFormatter(locale, options).format(date.toDate(tz))",
    temporal: perKind({
      PlainDate: 'date.toLocaleString(locale, { dateStyle: "long" })',
      PlainDateTime: FORMAT_DATE_TIME,
      ZonedDateTime: FORMAT_DATE_TIME,
    }),
    note: "A zoned value formats on its own wall clock and refuses `options.timeZone` (a `TypeError`): convert it with `withTimeZone(tz)` first. `Intl.DateTimeFormat#format` takes the plain kinds but throws on a `ZonedDateTime`. Fuse's own components format through `Intl` on `Date`s, so their text does not depend on this.",
  },
  {
    id: "to-string",
    from: "date.toString()",
    temporal: any("date.toString()"),
    note: "The same ISO text, which is also what `JSON.stringify` writes.",
  },
];
