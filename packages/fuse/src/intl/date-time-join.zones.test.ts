/**
 * Unit under test: `formatDateTime`, alone and through the public `formatChartSlot`. Oracle:
 * labels written by hand from CLDR 48, the same ones the engine judges hold.
 *
 * Node 24's ICU prints CLDR 48's own date-time join, so in Node a helper that handed the join back
 * to Intl would print the right text by luck. WebKit's older CLDR joins differently, and printed
 * `Oct 18, 2026 at 12:30 PM` where CLDR 48 writes `Oct 18, 2026, 12:30 PM`. This file models such
 * an engine. While it runs, every `Intl.DateTimeFormat` whose options hold both date and time fields
 * writes ` ENGINE JOIN ` between its date and time parts, in `format` and `formatToParts`. A
 * formatter for one half stays real. So a label that reaches Intl's join shows the sentinel.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { formatChartSlot } from "../components/chart/chart-format";
import { DATE_TIME_CASES, WEEKDAY_TIME_CASE } from "../components/chart/format/fixtures/time-literals";
import { formatDateTime } from "./date-time-join";

const SENTINEL = " ENGINE JOIN ";

/** The option keys the stand-in engine counts as date fields and as time fields. */
const DATE_KEYS = ["dateStyle", "weekday", "era", "year", "month", "day"];
const TIME_KEYS = ["timeStyle", "hour", "minute", "second", "fractionalSecondDigits", "dayPeriod"];
const DATE_PARTS: ReadonlySet<string> = new Set(["weekday", "era", "year", "month", "day"]);
const TIME_PARTS: ReadonlySet<string> = new Set([
  "hour",
  "minute",
  "second",
  "fractionalSecond",
  "dayPeriod",
]);

const RealDateTimeFormat = Intl.DateTimeFormat;

/** An `Intl.DateTimeFormat` that joins a date and a time with the sentinel. */
class EngineJoinDateTimeFormat extends RealDateTimeFormat {
  readonly #joins: boolean;

  constructor(locales?: Intl.LocalesArgument, options?: Intl.DateTimeFormatOptions) {
    super(locales, options);
    const asks = (keys: readonly string[]): boolean =>
      keys.some((key) => options !== undefined && Object.hasOwn(options, key));
    this.#joins = asks(DATE_KEYS) && asks(TIME_KEYS);
  }

  override formatToParts(date?: Date | number): Intl.DateTimeFormatPart[] {
    const parts = super.formatToParts(date);
    if (!this.#joins) {
      return parts;
    }
    // The join is the literal after the last date part that a time part follows.
    const join = parts.findIndex(
      (part, index) =>
        part.type === "literal" &&
        DATE_PARTS.has(parts[index - 1]?.type ?? "") &&
        TIME_PARTS.has(parts[index + 1]?.type ?? "")
    );
    return parts.map((part, index) => (index === join ? { type: "literal", value: SENTINEL } : part));
  }

  override format(date?: Date | number): string {
    return this.formatToParts(date)
      .map((part) => part.value)
      .join("");
  }
}

/** Every space Intl may write, as U+00A0, the way the hand-written labels spell them. */
const spaces = (text: string): string => text.replace(/[   ]/gu, " ");

const AT = Date.parse("2026-10-18T10:30:00Z");
const OSLO = { timeZone: "Europe/Oslo" } as const;

beforeAll(() => {
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function stub(locales, options) {
    return new EngineJoinDateTimeFormat(locales, options);
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("the stand-in engine", () => {
  it("writes its own join for date and time fields and keeps each half real", () => {
    expect(
      spaces(
        new Intl.DateTimeFormat("en-US", { ...OSLO, dateStyle: "medium", timeStyle: "short" }).format(AT)
      )
    ).toBe("Oct 18, 2026 ENGINE JOIN 12:30 PM");
    expect(new Intl.DateTimeFormat("en-US", { ...OSLO, dateStyle: "medium" }).format(AT)).toBe(
      "Oct 18, 2026"
    );
  });
});

const JOINED_CASES = DATE_TIME_CASES.filter((dateTimeCase) => dateTimeCase !== WEEKDAY_TIME_CASE);

describe("formatDateTime under an engine with another join", () => {
  it.each(JOINED_CASES.map((dateTimeCase) => [dateTimeCase.name, dateTimeCase] as const))(
    "joins %s with CLDR 48's pattern",
    (_, dateTimeCase) => {
      const options = { ...dateTimeCase.format, timeZone: dateTimeCase.zone };
      expect(spaces(formatDateTime(dateTimeCase.locale, options, Date.parse(dateTimeCase.at)))).toBe(
        dateTimeCase.text
      );
    }
  );

  it.each([
    [
      "a year",
      "en-US",
      { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
      "Oct 18, 2026, 12:30 PM",
    ],
    [
      "an era",
      "en-US",
      { era: "short", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
      "Oct 18, 2026 AD, 12:30 PM",
    ],
    [
      "seconds",
      "nb-NO",
      { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" },
      "18. oktober kl. 12:30:00",
    ],
    [
      "fractional seconds",
      "sv-SE",
      {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 1,
      },
      "18/10 12:30:00,0",
    ],
    [
      "a day period",
      "en-US",
      { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", dayPeriod: "short" },
      "Oct 18, 12:30 in the afternoon",
    ],
    [
      "a zone name on the time half",
      "en-US",
      { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" },
      "Oct 18, 12:30 PM GMT+2",
    ],
  ] as const)("keeps %s on its own half", (_, locale, fields, text) => {
    expect(spaces(formatDateTime(locale, { ...OSLO, ...fields }, AT))).toBe(text);
  });

  it("reads a field set to undefined as absent, so a date alone takes no join", () => {
    expect(
      spaces(formatDateTime("en-US", { ...OSLO, month: "short", day: "numeric", hour: undefined }, AT))
    ).toBe("Oct\u00a018");
  });

  it("leaves a weekday with a time, and a language outside the four, to the engine", () => {
    const weekday = { ...WEEKDAY_TIME_CASE.format, timeZone: WEEKDAY_TIME_CASE.zone };
    expect(formatDateTime("en-US", weekday, AT)).toContain(SENTINEL);
    expect(formatDateTime("de-DE", { ...OSLO, dateStyle: "long", timeStyle: "short" }, AT)).toContain(
      SENTINEL
    );
  });
});

describe("formatChartSlot under an engine with another join", () => {
  it.each(JOINED_CASES.map((dateTimeCase) => [dateTimeCase.name, dateTimeCase] as const))(
    "labels %s with CLDR 48's join in both forms",
    (_, dateTimeCase) => {
      const { locale, zone: timeZone, format } = dateTimeCase;
      const label = formatChartSlot(Date.parse(dateTimeCase.at), dateTimeCase.interval, {
        locale,
        timeZone,
        format,
      });
      expect(label).toEqual({ text: dateTimeCase.text, spoken: dateTimeCase.spoken });
    }
  );
});
