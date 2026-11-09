// The implementation the entry installs where an engine has none (Safari, Node 24), bound
// explicitly so the recipes run on it beside Node's.
import { Temporal as polyfillTemporal } from "temporal-polyfill/implementation";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The polyfill first, as the guide tells a host. Node 26, which runs this project, ships Temporal,
// so here the entry only sets its marker, and `globalThis.Temporal` stays Node's own.
import "@elmeragroup/fuse/temporal-polyfill";

import {
  DATE_KINDS,
  DATE_RECIPES,
} from "../src/app/(docs)/handbook/temporal-migration/sections/date-recipes";
import type { DateKind } from "../src/app/(docs)/handbook/temporal-migration/sections/date-recipes";

/**
 * Unit under test: the migration guide's printed Temporal recipes, evaluated as printed, once on
 * Node's native Temporal and once on temporal-polyfill's. Oracle: the results below, written out by
 * hand from the fixtures (and checked against `@internationalized/date` where the guide says the
 * recipe reproduces it); the one exception is `getLocalTimeZone()`, whose result is the runtime
 * zone as `Intl` reports it. A recipe that calls a method its kind lacks throws here; one that
 * drops a time or a zone writes a different string.
 */

/** Noon UTC: 08:00 in New York and 14:00 in Oslo, the same date in both. */
const NOW = "2026-10-05T12:00:00Z";

/** The values `a` (= `date`) and `b` per kind: Monday 2026-10-05, `b` later. */
const FIXTURES = {
  PlainDate: { a: "2026-10-05", b: "2026-10-30" },
  PlainDateTime: { a: "2026-10-05T09:30", b: "2026-10-05T18:00" },
  ZonedDateTime: { a: "2026-10-05T09:30[Europe/Oslo]", b: "2026-10-05T18:00[Europe/Oslo]" },
} as const satisfies Record<DateKind, { a: string; b: string }>;

/**
 * What the test reads from an implementation beside the recipes themselves, which get the whole
 * namespace: the fixtures' constructors and the format probe.
 */
type TemporalApi = {
  readonly PlainDate: { from(text: string): Printable };
  readonly PlainDateTime: { from(text: string): Printable };
  readonly ZonedDateTime: {
    from(text: string): { toLocaleString(locale: string, options: Intl.DateTimeFormatOptions): string };
  };
  readonly PlainTime: { from(text: string): Printable };
};

/** A Temporal value as the scope holds it: something a recipe reads and the test prints. */
type Printable = { toString(): string };

/**
 * The two implementations every recipe runs on, each read when a case runs: the fake clock swaps
 * the native global for its own while the tests run.
 */
const IMPLEMENTATIONS: readonly (readonly [string, () => TemporalApi])[] = [
  ["native Temporal", () => globalThis.Temporal],
  ["temporal-polyfill", () => polyfillTemporal],
];

/** Where a case runs: once on its own, or with the values of one kind. */
type CaseKind = DateKind | "standalone";

/**
 * Runs a printed expression on `temporal` with the guide's names bound for `kind`, the values
 * built by that same implementation. A standalone case gets no values, so a standalone recipe
 * that reads `date`, `a` or `b` throws.
 */
function evaluate(code: string, kind: CaseKind, temporal: TemporalApi): string {
  const a = kind === "standalone" ? undefined : temporal[kind].from(FIXTURES[kind].a);
  const b = kind === "standalone" ? undefined : temporal[kind].from(FIXTURES[kind].b);
  const scope = {
    Temporal: temporal,
    date: a,
    a,
    b,
    tz: "America/New_York",
    locale: "en-US",
    firstDay: 7,
    time: temporal.PlainTime.from("14:15"),
    jsDate: new Date("2026-10-05T07:30:00Z"),
  };
  // SAFETY: every recipe is one expression over the scope's names, whose value (a Temporal value
  // of either implementation, a `Date`, a string, a number or a boolean) prints with toString.
  // oxlint-disable-next-line typescript/no-implied-eval -- the guide prints these expressions, and evaluating the printed text is the point of the test
  const run = new Function(...Object.keys(scope), `return (${code});`) as (
    ...args: readonly unknown[]
  ) => Printable;
  const result = run(...Object.values(scope));
  return result instanceof Date ? result.toISOString() : String(result);
}

/** A recipe's result per kind it covers, or its one standalone result. */
type KindResults = Partial<Record<CaseKind, string>>;

/** The one result of a standalone recipe. */
function once(result: string): KindResults {
  return { standalone: result };
}

/** The same result for all three kinds. */
function all(result: string): KindResults {
  return { PlainDate: result, PlainDateTime: result, ZonedDateTime: result };
}

const ZONED_A = "2026-10-05T09:30:00+02:00[Europe/Oslo]";

/**
 * The guide's results, keyed by recipe id. A Map, so a lookup by a recipe's `string` id is typed
 * as possibly missing; the literal is checked against the row shape with `satisfies`.
 */
const EXPECTED = new Map<string, KindResults>(
  Object.entries({
    "new-calendar-date": once("2026-10-05"),
    "new-calendar-date-time": once("2026-10-05T09:30:00"),
    "new-zoned-date-time": once(ZONED_A),
    "new-time": once("09:30:00"),
    "parse-date": once("2026-10-05"),
    "parse-date-time": once("2026-10-05T09:30:00"),
    "parse-zoned-date-time": once(ZONED_A),
    "parse-absolute": once("2026-10-05T03:30:00-04:00[America/New_York]"),
    "parse-time": once("09:30:00"),
    today: once("2026-10-05"),
    now: once("2026-10-05T08:00:00-04:00[America/New_York]"),
    set: {
      PlainDate: "2026-10-01",
      PlainDateTime: "2026-10-01T09:30:00",
      ZonedDateTime: "2026-10-01T09:30:00+02:00[Europe/Oslo]",
    },
    add: once("2026-02-28"),
    compare: all("-1"),
    "same-day": { PlainDate: "false", PlainDateTime: "true", ZonedDateTime: "true" },
    "same-month": all("true"),
    "same-year": all("true"),
    "is-today": all("true"),
    "start-of-month": {
      PlainDate: "2026-10-01",
      PlainDateTime: "2026-10-01T09:30:00",
      ZonedDateTime: "2026-10-01T09:30:00+02:00[Europe/Oslo]",
    },
    // Oslo leaves summer time on 2026-10-25, so the month's last day is +01:00.
    "end-of-month": {
      PlainDate: "2026-10-31",
      PlainDateTime: "2026-10-31T09:30:00",
      ZonedDateTime: "2026-10-31T09:30:00+01:00[Europe/Oslo]",
    },
    "start-of-year": {
      PlainDate: "2026-01-01",
      PlainDateTime: "2026-01-01T09:30:00",
      ZonedDateTime: "2026-01-01T09:30:00+01:00[Europe/Oslo]",
    },
    "end-of-year": {
      PlainDate: "2026-12-31",
      PlainDateTime: "2026-12-31T09:30:00",
      ZonedDateTime: "2026-12-31T09:30:00+01:00[Europe/Oslo]",
    },
    // en-US weeks start on Sunday: Monday is 1 (as React Aria's getDayOfWeek), the week Oct 4–10.
    "day-of-week": all("1"),
    "start-of-week": {
      PlainDate: "2026-10-04",
      PlainDateTime: "2026-10-04T09:30:00",
      ZonedDateTime: "2026-10-04T09:30:00+02:00[Europe/Oslo]",
    },
    "end-of-week": {
      PlainDate: "2026-10-10",
      PlainDateTime: "2026-10-10T09:30:00",
      ZonedDateTime: "2026-10-10T09:30:00+02:00[Europe/Oslo]",
    },
    "is-weekend": all("false"),
    "to-calendar-date": all("2026-10-05"),
    "to-calendar-date-time": all("2026-10-05T14:15:00"),
    "to-time": { PlainDateTime: "09:30:00", ZonedDateTime: "09:30:00" },
    "to-zoned": {
      PlainDate: "2026-10-05T00:00:00-04:00[America/New_York]",
      PlainDateTime: "2026-10-05T09:30:00-04:00[America/New_York]",
      ZonedDateTime: "2026-10-05T03:30:00-04:00[America/New_York]",
    },
    "to-zoned-dst-gap": once("2026-03-29T03:30:00+02:00[Europe/Oslo]"),
    "to-time-zone": { ZonedDateTime: "2026-10-05T03:30:00-04:00[America/New_York]" },
    "to-date": {
      PlainDate: "2026-10-05T04:00:00.000Z",
      PlainDateTime: "2026-10-05T13:30:00.000Z",
      ZonedDateTime: "2026-10-05T07:30:00.000Z",
    },
    "from-date": once("2026-10-05T03:30:00-04:00[America/New_York]"),
    // A zoned value formats on its own (Oslo) wall clock.
    format: {
      PlainDate: "October 5, 2026",
      PlainDateTime: "October 5, 2026 at 9:30 AM",
      ZonedDateTime: "October 5, 2026 at 9:30 AM",
    },
    "to-string": { PlainDate: "2026-10-05", PlainDateTime: "2026-10-05T09:30:00", ZonedDateTime: ZONED_A },
    // The one result read from the environment: the runtime zone as Intl reports it, independent of
    // Temporal.
    "local-time-zone": once(Intl.DateTimeFormat().resolvedOptions().timeZone),
  } satisfies Record<string, KindResults>)
);

/** Every evaluated case: [recipe id, kind, code]. */
const CASES = DATE_RECIPES.flatMap((recipe): (readonly [string, CaseKind, string])[] => {
  const { temporal } = recipe;
  switch (temporal.kind) {
    case "none": {
      return [];
    }
    case "standalone": {
      return [[recipe.id, "standalone", temporal.code]];
    }
    case "any": {
      return DATE_KINDS.map((kind) => [recipe.id, kind, temporal.code] as const);
    }
    case "per-kind": {
      return DATE_KINDS.flatMap((kind) => {
        const code = temporal.code[kind];
        return code === undefined ? [] : [[recipe.id, kind, code] as const];
      });
    }
  }
});

/** Every evaluated case on every implementation: [implementation, recipe id, kind, code, Temporal]. */
const RUNS = IMPLEMENTATIONS.flatMap(([implementation, temporal]) =>
  CASES.map(([id, kind, code]) => [implementation, id, kind, code, temporal] as const)
);

describe("Temporal migration recipes", () => {
  beforeAll(() => {
    // Node's own `Temporal.Now` reads the system clock, not `Date`, so the clock fakes both.
    vi.useFakeTimers({ toFake: ["Date", "Temporal"] });
    vi.setSystemTime(new Date(NOW));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("binds Node's native Temporal and the polyfill's JavaScript one", () => {
    // Premise: Node ships Temporal, so the entry left it in place, and the polyfill's is JavaScript.
    const native = IMPLEMENTATIONS.map(([name, read]) => [
      name,
      Function.prototype.toString.call(read().PlainDate).includes("[native code]"),
    ]);
    expect(native).toEqual([
      ["native Temporal", true],
      ["temporal-polyfill", false],
    ]);
  });

  it.each(RUNS)(
    "on %s, %s for a %s gives the guide's result",
    (_implementation, id, kind, code, temporal) => {
      expect(evaluate(code, kind, temporal())).toBe(EXPECTED.get(id)?.[kind]);
    }
  );

  it.each(IMPLEMENTATIONS)(
    "on %s, a zoned value given options.timeZone throws the TypeError the format note names",
    (_implementation, temporal) => {
      const zoned = temporal().ZonedDateTime.from(FIXTURES.ZonedDateTime.a);
      expect(() => zoned.toLocaleString("en-US", { timeZone: "UTC" })).toThrow(TypeError);
      const note = DATE_RECIPES.find((recipe) => recipe.id === "format")?.note;
      expect(note).toContain("(a `TypeError`)");
    }
  );

  it("binds a value in every recipe it runs per kind", () => {
    // A recipe that reads no value belongs with the standalone ones, which run once.
    const valueFree = DATE_RECIPES.flatMap((recipe) =>
      recipe.temporal.kind === "any" && !/\b(?:date|a|b)\b/u.test(recipe.temporal.code) ? [recipe.id] : []
    );
    expect(valueFree).toEqual([]);
  });

  it("holds no expectation for a case it never runs", () => {
    // A missing expectation already fails its case above; a stale one would never run.
    const run = new Set(CASES.map(([id, kind]) => `${id}/${kind}`));
    const written = [...EXPECTED].flatMap(([id, results]) =>
      Object.keys(results).map((kind) => `${id}/${kind}`)
    );
    expect(written.filter((key) => !run.has(key))).toEqual([]);
  });
});
