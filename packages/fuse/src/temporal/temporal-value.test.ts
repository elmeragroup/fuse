import { describe, expect, it } from "vitest";

import { getOrThrow } from "@elmeragroup/color/result";

/**
 * Unit under test: `parseTemporal`, `resolveValueKind` and `sameKind`. Oracle: ISO 8601 / RFC 9557 text and
 * the kind-resolution order in the date-tier plan (value, then the kind resolved before, then the
 * default value, then granularity and time zone), written out by hand.
 */
import "../temporal-polyfill";
import {
  GranularityConflictError,
  parseTemporal,
  resolveValueKind,
  sameKind,
  TemporalInputError,
} from "./temporal-value";
import type { DateGranularity, MadeValue, ResolvedKind, ValueKind, ValueKindSources } from "./temporal-value";

/** The parsed value's kind and ISO text, or the failed input. */
function parsed(input: string): string {
  const result = parseTemporal(input);
  return result._tag === "ok"
    ? `${Object.prototype.toString.call(result.value)} ${result.value.toString()}`
    : `error ${result.error.input}`;
}

const EMPTY: ValueKindSources = {
  value: null,
  previous: undefined,
  defaultValue: undefined,
  granularity: undefined,
  timeZone: undefined,
};

describe("parseTemporal", () => {
  it.each([
    ["2026-03-15", "[object Temporal.PlainDate] 2026-03-15"],
    ["20260315", "[object Temporal.PlainDate] 2026-03-15"],
    // The Gregorian calendar's dates are ISO dates, so its values come back in the ISO calendar.
    ["2026-03-15[u-ca=gregory]", "[object Temporal.PlainDate] 2026-03-15"],
    ["2026-03-15[u-ca=ISO8601]", "[object Temporal.PlainDate] 2026-03-15"],
    ["2026-03-15T09:30[u-ca=gregory]", "[object Temporal.PlainDateTime] 2026-03-15T09:30:00"],
    ["2026-03-15T09:30", "[object Temporal.PlainDateTime] 2026-03-15T09:30:00"],
    ["2026-03-15 09:30:15", "[object Temporal.PlainDateTime] 2026-03-15T09:30:15"],
    [
      "2026-03-15T09:30+01:00[Europe/Oslo]",
      "[object Temporal.ZonedDateTime] 2026-03-15T09:30:00+01:00[Europe/Oslo]",
    ],
    [
      "2026-03-15T09:30+01:00[!Europe/Oslo][u-ca=gregory]",
      "[object Temporal.ZonedDateTime] 2026-03-15T09:30:00+01:00[Europe/Oslo]",
    ],
  ])("reads %s by its form", (input, expected) => {
    expect(parsed(input)).toBe(expected);
  });

  it("keeps the instant an offset names when the zone's rules disagree with it", () => {
    // Oslo is at +01:00 on March 15, so 09:30+02:00 is 07:30 UTC, which Oslo reads as 08:30.
    expect(parsed("2026-03-15T09:30+02:00[Europe/Oslo]")).toBe(
      "[object Temporal.ZonedDateTime] 2026-03-15T08:30:00+01:00[Europe/Oslo]"
    );
  });

  it("round-trips a ZonedDateTime whose zone's offset has seconds", () => {
    // Monrovia kept -00:44:30 until 1972; the ISO text prints the offset rounded to -00:45.
    const monrovia = Temporal.ZonedDateTime.from("1960-06-01T00:00[Africa/Monrovia]");
    expect(monrovia.toString()).toBe("1960-06-01T00:00:00-00:45[Africa/Monrovia]");
    const result = getOrThrow(parseTemporal(String(monrovia)));
    expect(result.toString()).toBe("1960-06-01T00:00:00-00:45[Africa/Monrovia]");
    expect(result instanceof Temporal.ZonedDateTime && result.equals(monrovia)).toBe(true);
  });

  it.each([
    ["a run of unclosed brackets", `2026-03-15${"[".repeat(64_000)}`],
    ["a run of unclosed calendar annotations", `2026-03-15${"[u-ca=".repeat(16_000)}`],
  ])("refuses %s", (_case, input) => {
    expect(parseTemporal(input)._tag).toBe("err");
  });

  it.each([
    // A calendar other than ISO 8601 or Gregorian, which native Temporal reads and the polyfill
    // the subpath installs does not: refused in every engine.
    "2026-03-15[u-ca=hebrew]",
    "2026-03-15T09:30[!u-ca=japanese]",
    "2026-03-15T09:30+01:00[Europe/Oslo][u-ca=islamic-civil]",
    "2026-03-15[u-ca=gregory][u-ca=hebrew]",
  ])("refuses the non-ISO calendar in %j", (input) => {
    expect(parsed(input)).toBe(`error ${input}`);
  });

  it.each([
    // An instant: an offset or Z with no bracketed zone is none of the three kinds, and a plain
    // parse would drop the offset.
    "2026-03-15T09:30:00.000Z",
    "2026-03-15T09:30z",
    "2026-03-15T09:30+01:00",
    "2026-03-15T09:30-04:00",
    "2026-03-15T09:30+00:00",
    "2026-03-15T09:30:15.5+0100",
    "2026-03-15 09:30-04",
    // A date the calendar does not have.
    "2026-02-30",
    // A month, not a date.
    "2026-03",
    "next Tuesday",
    "",
  ])("refuses %j", (input) => {
    expect(parsed(input)).toBe(`error ${input}`);
  });

  it("returns a TemporalInputError carrying Temporal's own error when the fields are out of range", () => {
    const result = parseTemporal("2026-02-30");
    expect(result._tag === "err" && result.error).toBeInstanceOf(TemporalInputError);
    expect(result._tag === "err" && result.error.cause).toBeInstanceOf(RangeError);
  });
});

describe("the date errors", () => {
  it("print their own names", () => {
    const input = parseTemporal("next Tuesday");
    expect(input._tag === "err" && String(input.error)).toMatch(
      /^TemporalInputError: "next Tuesday" is not a date/u
    );
    const conflict = resolveValueKind({
      ...EMPTY,
      value: getOrThrow(parseTemporal("2026-03-15")),
      granularity: "hour",
    });
    expect(conflict._tag === "err" && String(conflict.error)).toMatch(
      /^GranularityConflictError: granularity "hour" needs a value with a time/u
    );
  });
});

describe("resolveValueKind", () => {
  const named = (kind: ValueKind): ResolvedKind => ({ kind, named: true });
  const made = (kind: ValueKind): ResolvedKind => ({ kind, named: false });

  it.each<[string, ValueKindSources, ResolvedKind]>([
    ["nothing names a kind", EMPTY, made({ kind: "PlainDate" })],
    ["granularity day", { ...EMPTY, granularity: "day" }, made({ kind: "PlainDate" })],
    [
      "a time granularity without a zone",
      { ...EMPTY, granularity: "minute" },
      made({ kind: "PlainDateTime" }),
    ],
    [
      "a time granularity with a zone",
      { ...EMPTY, granularity: "second", timeZone: "Europe/Oslo" },
      made({ kind: "ZonedDateTime", timeZone: "Europe/Oslo" }),
    ],
    [
      "the value, over the default value",
      {
        ...EMPTY,
        value: getOrThrow(parseTemporal("2026-03-15T09:30")),
        defaultValue: getOrThrow(parseTemporal("2026-03-15")),
      },
      named({ kind: "PlainDateTime" }),
    ],
    [
      "the value's own zone, over the timeZone given",
      {
        ...EMPTY,
        value: getOrThrow(parseTemporal("2026-03-15T09:30-04:00[America/New_York]")),
        granularity: "minute",
        timeZone: "Europe/Oslo",
      },
      named({ kind: "ZonedDateTime", timeZone: "America/New_York" }),
    ],
    [
      "the value, over a named kind from before",
      {
        ...EMPTY,
        value: getOrThrow(parseTemporal("2026-03-15T09:30")),
        previous: named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
        granularity: "minute",
      },
      named({ kind: "PlainDateTime" }),
    ],
    [
      "the kind before a clear, over the default value",
      {
        ...EMPTY,
        previous: named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
        defaultValue: getOrThrow(parseTemporal("2026-03-15")),
        granularity: "minute",
      },
      named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
    ],
    [
      "the granularity and zone, over a made kind from before",
      {
        ...EMPTY,
        previous: made({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
        granularity: "minute",
        timeZone: "America/New_York",
      },
      made({ kind: "ZonedDateTime", timeZone: "America/New_York" }),
    ],
    [
      "the granularity, over a PlainDate kept from before a clear",
      { ...EMPTY, previous: named({ kind: "PlainDate" }), granularity: "hour" },
      made({ kind: "PlainDateTime" }),
    ],
    [
      "the default value, over a PlainDate kept from before a clear",
      {
        ...EMPTY,
        previous: named({ kind: "PlainDate" }),
        defaultValue: getOrThrow(parseTemporal("2026-03-15T09:30+09:00[Asia/Tokyo]")),
        granularity: "hour",
      },
      named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
    ],
    [
      "the default value while the value starts empty",
      {
        ...EMPTY,
        defaultValue: getOrThrow(parseTemporal("2026-03-15T09:30+09:00[Asia/Tokyo]")),
        granularity: "minute",
      },
      named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
    ],
    [
      "a value with a time under granularity day",
      { ...EMPTY, value: getOrThrow(parseTemporal("2026-03-15T09:30")), granularity: "day" },
      named({ kind: "PlainDateTime" }),
    ],
  ])("resolves from %s", (_case, sources, expected) => {
    expect(resolveValueKind(sources)).toEqual({ _tag: "ok", value: expected });
  });

  it.each<[string, ValueKindSources]>([
    ["a PlainDate value", { ...EMPTY, value: getOrThrow(parseTemporal("2026-03-15")), granularity: "hour" }],
    [
      "a PlainDate default value",
      { ...EMPTY, defaultValue: getOrThrow(parseTemporal("2026-03-15")), granularity: "hour" },
    ],
    [
      "a PlainDate default value behind a PlainDate kept from before a clear",
      {
        ...EMPTY,
        previous: named({ kind: "PlainDate" }),
        defaultValue: getOrThrow(parseTemporal("2026-03-15")),
        granularity: "hour",
      },
    ],
  ])("refuses a time granularity for %s", (_case, sources) => {
    const result = resolveValueKind(sources);
    expect(result._tag === "err" && result.error).toBeInstanceOf(GranularityConflictError);
    expect(result._tag === "err" && result.error.granularity).toBe("hour");
  });

  /** Resolves each step in turn, passing the kind returned before as `previous`, as a component does. */
  function resolveInTurn(steps: ReadonlyArray<Omit<ValueKindSources, "previous">>): unknown[] {
    let previous: ValueKindSources["previous"];
    return steps.map((step) => {
      const result = resolveValueKind({ ...step, previous });
      if (result._tag === "ok") {
        previous = result.value;
      }
      return result._tag === "ok" ? result.value : result.error.name;
    });
  }

  it("follows a granularity change while no value has named a kind", () => {
    expect(
      resolveInTurn([
        { ...EMPTY, granularity: "day" },
        { ...EMPTY, granularity: "minute" },
        { ...EMPTY, granularity: "day" },
      ])
    ).toEqual([made({ kind: "PlainDate" }), made({ kind: "PlainDateTime" }), made({ kind: "PlainDate" })]);
  });

  it("follows a timeZone change while no value has named a kind", () => {
    expect(
      resolveInTurn([
        { ...EMPTY, granularity: "minute", timeZone: "Europe/Oslo" },
        { ...EMPTY, granularity: "minute", timeZone: "America/New_York" },
      ])
    ).toEqual([
      made({ kind: "ZonedDateTime", timeZone: "Europe/Oslo" }),
      made({ kind: "ZonedDateTime", timeZone: "America/New_York" }),
    ]);
  });

  it("keeps a kind a value named through a clear and a later timeZone change", () => {
    expect(
      resolveInTurn([
        {
          ...EMPTY,
          value: getOrThrow(parseTemporal("2026-03-15T09:30+09:00[Asia/Tokyo]")),
          granularity: "minute",
        },
        { ...EMPTY, granularity: "minute" },
        { ...EMPTY, granularity: "minute", timeZone: "America/New_York" },
      ])
    ).toEqual([
      named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
      named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
      named({ kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }),
    ]);
  });

  it("follows a granularity toggle after a typed date is cleared", () => {
    expect(
      resolveInTurn([
        { ...EMPTY },
        { ...EMPTY, value: getOrThrow(parseTemporal("2026-03-15")) },
        { ...EMPTY },
        { ...EMPTY, granularity: "minute" },
        { ...EMPTY, granularity: "day" },
      ])
    ).toEqual([
      made({ kind: "PlainDate" }),
      named({ kind: "PlainDate" }),
      named({ kind: "PlainDate" }),
      made({ kind: "PlainDateTime" }),
      made({ kind: "PlainDate" }),
    ]);
  });
});

/** A Temporal type's kind name; a ZonedDateTime is tested first, since it holds a date and time too. */
type KindName<V> = V extends Temporal.ZonedDateTime
  ? "ZonedDateTime"
  : V extends Temporal.PlainDateTime
    ? "PlainDateTime"
    : "PlainDate";

/**
 * One row of the kind table. The type checker holds `kind` to `MadeValue<G, Z>`, the type the
 * components' value kind defaults to; the test below holds it to `resolveValueKind`.
 */
function row<const G extends DateGranularity | undefined, const Z extends string | undefined>(
  granularity: G,
  timeZone: Z,
  kind: KindName<MadeValue<G, Z>>
) {
  return { granularity, timeZone, kind };
}

/**
 * Unit under test: the props fallback twice over, `MadeValue` in the types and `madeKind` (through
 * `resolveValueKind`) at runtime. Oracle: this hand-written table of granularity and time zone,
 * so neither can drift from the other unseen.
 */
describe("the kind granularity and timeZone make without a value", () => {
  it.each([
    row(undefined, undefined, "PlainDate"),
    row(undefined, "Europe/Oslo", "PlainDate"),
    row("day", undefined, "PlainDate"),
    row("day", "Europe/Oslo", "PlainDate"),
    row("hour", undefined, "PlainDateTime"),
    row("minute", undefined, "PlainDateTime"),
    row("second", undefined, "PlainDateTime"),
    row("hour", "Europe/Oslo", "ZonedDateTime"),
    row("minute", "Asia/Tokyo", "ZonedDateTime"),
    row("second", "America/New_York", "ZonedDateTime"),
  ])("granularity $granularity with timeZone $timeZone makes a $kind", ({ granularity, timeZone, kind }) => {
    const resolved = getOrThrow(resolveValueKind({ ...EMPTY, granularity, timeZone }));
    expect(resolved).toEqual({
      kind: kind === "ZonedDateTime" ? { kind, timeZone } : { kind },
      named: false,
    });
  });
});

describe("sameKind", () => {
  it.each<[ValueKind, ValueKind, boolean]>([
    [{ kind: "PlainDate" }, { kind: "PlainDate" }, true],
    [{ kind: "PlainDate" }, { kind: "PlainDateTime" }, false],
    [
      { kind: "ZonedDateTime", timeZone: "Asia/Tokyo" },
      { kind: "ZonedDateTime", timeZone: "Asia/Tokyo" },
      true,
    ],
    [
      { kind: "ZonedDateTime", timeZone: "Asia/Tokyo" },
      { kind: "ZonedDateTime", timeZone: "Europe/Oslo" },
      false,
    ],
    [{ kind: "PlainDateTime" }, { kind: "ZonedDateTime", timeZone: "Asia/Tokyo" }, false],
  ])("compares %o and %o as %s", (left, right, expected) => {
    expect(sameKind(left, right)).toBe(expected);
    expect(sameKind(right, left)).toBe(expected);
  });
});
