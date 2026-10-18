/**
 * This file judges the chart format modules in Node. Each judge compares Fuse's labels with an
 * expectation from outside Fuse: the zoneinfo slot oracle, the frozen market data or literals
 * written by hand from CLDR 48. fast-check properties and metamorphic relations cover the rest.
 * `format.engines.browser.test.ts` runs the same judges in Chromium, Firefox and WebKit.
 */

import * as fc from "fast-check";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { canonicalSpaces } from "../../../intl/canonical-spaces";
import { LOCALES } from "./fixtures/judgement";
import { JUDGES } from "./fixtures/judges";
import { oracleDays } from "./fixtures/time-judges";
import { formatTime } from "./time-format";
import { formatValue } from "./value-format";
import type { ValueFormat } from "./value-format";

const SEED = 20_261_018;

/** Run `fixtures/zone-probe.ts` in a fresh Node process whose runtime zone is `zone`. */
function runZoneProbe(zone: string): string {
  const probe = fileURLToPath(new URL("./fixtures/zone-probe.ts", import.meta.url));
  const resolver = fileURLToPath(new URL("../../../../scripts/ts-resolve.mjs", import.meta.url));
  return execFileSync(
    process.execPath,
    ["--experimental-strip-types", "--experimental-transform-types", "--import", resolver, probe],
    // The child gets only TZ from this process.
    { env: { TZ: zone }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

describe("chart formats in Node", () => {
  it.each(JUDGES)("match the judges of %s", (_, judge) => {
    for (const judgement of judge()) {
      expect(judgement.actual, judgement.name).toEqual(judgement.expected);
    }
  });

  it.each(["America/New_York", "Asia/Tokyo"])("match every judge when the process runs in %s", (zone) => {
    // Unit under test: every judged label. Oracle: the judges themselves, so the process zone
    // changes no string.
    expect(JSON.parse(runZoneProbe(zone))).toEqual({ zone, mismatches: [] });
  });

  it("keeps each day's slot count, order and repeated-hour positions when the locale changes", () => {
    // Unit under test: formatTime across locales. Oracle: the relation itself. Labels differ per
    // locale, but which slots share a wall-clock label must not.
    for (const interval of ["hour", "quarter-hour"] as const) {
      for (const [zone, day, list] of oracleDays(interval)) {
        const repeats = LOCALES.map((locale) => {
          const labels = list.utc_start.map(
            (start) =>
              formatTime(
                locale,
                zone,
                { start: Date.parse(start), interval },
                interval === "hour" ? "hour-range" : "time-range",
                "tick"
              ).text
          );
          return labels.map((label) => labels.indexOf(label));
        });
        for (const firstIndexes of repeats) {
          expect(firstIndexes, `${interval} ${zone} ${day}`).toEqual(repeats[0]);
        }
      }
    }
  });

  it("throws a RangeError for a range preset over a day, and for a zone that isn't IANA", () => {
    expect(() =>
      formatTime("nb-NO", "Europe/Oslo", { start: 0, interval: "day" }, "hour-range", "full")
    ).toThrow(new RangeError("The hour-range preset needs a minute, quarter-hour or hour interval, not day"));
    expect(() => formatTime("nb-NO", "Europe/Osloo", { start: 0, interval: "hour" }, "hour", "full")).toThrow(
      RangeError
    );
  });
});

describe("values", () => {
  it("maps every space to U+00A0 idempotently and leaves no other space", () => {
    const spaced = fc.string({
      unit: fc.constantFrom("a", "1", ",", "\u0020", "\u2009", "\u202f", "\u00a0", "\u2013", "\u2212"),
    });
    fc.assert(
      fc.property(spaced, (text) => {
        const once = canonicalSpaces(text);
        expect(canonicalSpaces(once)).toBe(once);
        expect(once).not.toMatch(/[\u0020\u2009\u202f]/u);
        expect(once.length).toBe(text.length);
      }),
      { seed: SEED }
    );
  });

  const FORMATS: readonly ValueFormat[] = [
    { maximumFractionDigits: 2 },
    { style: "percent", maximumFractionDigits: 1 },
    { style: "currency", currency: "EUR" },
    { preset: "energy", unit: "kWh" },
    { preset: "power", unit: "MW", maximumFractionDigits: 1 },
    { preset: "unit-price", currency: "NOK", vat: "included" },
    { preset: "unit-price", currency: "EUR", minor: true, vat: "excluded" },
  ];
  const locale = fc.constantFrom(...LOCALES);
  const format = fc.constantFrom(...FORMATS);
  const value = fc.double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true });

  it("writes a negative value as U+2212 followed by its positive form, unless it rounds to zero", () => {
    fc.assert(
      fc.property(locale, format, value, fc.constantFrom("tick", "full"), (language, chosen, x, role) => {
        const positive = formatValue(language, Math.abs(x), chosen, role).text;
        const negative = formatValue(language, -Math.abs(x), chosen, role).text;
        const zero = formatValue(language, 0, chosen, role).text;
        if (positive === zero) {
          expect(negative).toBe(zero);
          expect(negative).not.toContain("\u2212");
        } else {
          expect(negative).toBe(`\u2212${positive}`);
        }
      }),
      { seed: SEED }
    );
  });

  it("prints values that round to zero, and \u22120, unsigned", () => {
    fc.assert(
      fc.property(locale, fc.double({ min: -0.0049, max: 0.0049, noNaN: true }), (language, x) => {
        const label = formatValue(language, x, { maximumFractionDigits: 2 }, "full");
        expect(label.text).toBe("0");
        expect(label.spoken).toBe("0");
      }),
      { seed: SEED }
    );
  });
});
