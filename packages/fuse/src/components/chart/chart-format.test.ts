/**
 * Unit under test: the public `formatChartSlot`. Oracle: the relation that an instant reads the
 * same as epoch milliseconds and as a `Date`, and the error the contract names. Its labels, and
 * those of `formatChartValue`, run in every engine as the shared judges in
 * `format/fixtures/judges.ts`.
 */
import { describe, expect, it } from "vitest";

import { formatChartSlot } from "./chart-format";

const OSLO = { locale: "nb-NO", timeZone: "Europe/Oslo" } as const;

describe("formatChartSlot", () => {
  it("reads epoch milliseconds and a Date as the same instant", () => {
    const at = "2026-10-17T15:30:00Z";
    expect(formatChartSlot(Date.parse(at), "hour", OSLO)).toEqual(
      formatChartSlot(new Date(at), "hour", OSLO)
    );
  });

  it("prints a second's default label after CLDR's Hms with a two-digit hour (F1)", () => {
    // 13:42:04 in Oslo on 17 October 2026, which is UTC+2, written by hand.
    expect(formatChartSlot(new Date(Date.UTC(2026, 9, 17, 11, 42, 4)), "second", OSLO).text).toBe("13:42:04");
  });
});
