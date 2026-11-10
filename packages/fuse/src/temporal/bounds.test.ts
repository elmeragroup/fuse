import { describe, expect, it } from "vitest";

import { getOrThrow } from "@elmeragroup/color/result";

/**
 * Unit under test: `checkBounds`. Oracle: React Aria's `value.compare(bound)` from
 * `@internationalized/date`, as its source reads:
 * a plain value reads the bound's own wall clock, a zoned value compares instants with a plain
 * bound read in the value's zone. Every value names its zone, so the results hold in each process
 * zone this file runs in.
 */
import "../temporal-polyfill";
import { checkBounds } from "./bounds";
import type { BoundsCheck } from "./bounds";
import { parseTemporal } from "./temporal-value";

function check(subject: string, bounds: { min?: string; max?: string }): BoundsCheck {
  return checkBounds(getOrThrow(parseTemporal(subject)), {
    min: bounds.min === undefined ? undefined : getOrThrow(parseTemporal(bounds.min)),
    max: bounds.max === undefined ? undefined : getOrThrow(parseTemporal(bounds.max)),
  });
}

describe("checkBounds", () => {
  it("allows any value without bounds, and each bound itself", () => {
    expect(check("2026-10-10", {})).toBe("within");
    expect(check("2026-10-10", { min: "2026-10-10", max: "2026-10-10" })).toBe("within");
    expect(check("2026-10-09", { min: "2026-10-10" })).toBe("underflow");
    expect(check("2026-10-11", { max: "2026-10-10" })).toBe("overflow");
  });

  it("checks the minimum first when the bounds are reversed", () => {
    expect(check("2026-10-11", { min: "2026-10-12", max: "2026-10-10" })).toBe("underflow");
  });

  describe("a PlainDate value", () => {
    it("compares days with a PlainDateTime bound's date", () => {
      expect(check("2026-10-10", { max: "2026-10-10T08:00" })).toBe("within");
      expect(check("2026-10-10", { max: "2026-10-09T23:59" })).toBe("overflow");
      expect(check("2026-10-10", { min: "2026-10-10T23:59" })).toBe("within");
    });

    it("compares days with a ZonedDateTime bound's date on its own wall clock", () => {
      // 23:30 in New York on October 9 is October 10 in Oslo; the bound's own date is the 9th.
      expect(check("2026-10-10", { max: "2026-10-09T23:30-04:00[America/New_York]" })).toBe("overflow");
      expect(check("2026-10-09", { max: "2026-10-09T23:30-04:00[America/New_York]" })).toBe("within");
    });
  });

  describe("a PlainDateTime value", () => {
    it("reads a PlainDate bound as its midnight", () => {
      expect(check("2026-10-10T10:00", { max: "2026-10-10" })).toBe("overflow");
      expect(check("2026-10-10T00:00", { max: "2026-10-10" })).toBe("within");
      expect(check("2026-10-10T10:00", { min: "2026-10-10" })).toBe("within");
    });

    it("compares wall clocks with a ZonedDateTime bound's own wall clock", () => {
      expect(check("2026-10-10T10:00", { max: "2026-10-10T10:30+02:00[Europe/Oslo]" })).toBe("within");
      // 09:30 in New York is 15:30 in Oslo, yet the bound's wall clock reads 09:30.
      expect(check("2026-10-10T10:00", { max: "2026-10-10T09:30-04:00[America/New_York]" })).toBe("overflow");
    });
  });

  describe("a ZonedDateTime value", () => {
    it("reads a PlainDateTime bound as that wall clock in the value's zone", () => {
      // 20:15 in New York is 02:15 on October 1 in Oslo, but the bound is read in New York.
      expect(check("2026-09-30T20:15-04:00[America/New_York]", { max: "2026-09-30T23:30" })).toBe("within");
      expect(check("2026-09-30T20:15-04:00[America/New_York]", { max: "2026-09-30T20:00" })).toBe("overflow");
    });

    it("reads a PlainDate bound as its midnight in the value's zone", () => {
      expect(check("2026-09-30T00:00-04:00[America/New_York]", { max: "2026-09-30" })).toBe("within");
      expect(check("2026-09-30T00:01-04:00[America/New_York]", { max: "2026-09-30" })).toBe("overflow");
    });

    it("compares a ZonedDateTime bound as an instant", () => {
      // Midnight in Oslo on October 1 is 18:00 on September 30 in New York.
      const min = "2026-10-01T00:00+02:00[Europe/Oslo]";
      expect(check("2026-09-30T17:59-04:00[America/New_York]", { min })).toBe("underflow");
      expect(check("2026-09-30T18:00-04:00[America/New_York]", { min })).toBe("within");
    });

    it("moves a bound in a spring-forward gap to the later instant", () => {
      // Oslo skips 02:00–03:00 on 2026-03-29, so 02:30 reads as 03:30+02:00.
      expect(check("2026-03-29T03:00+02:00[Europe/Oslo]", { min: "2026-03-29T02:30" })).toBe("underflow");
      expect(check("2026-03-29T03:30+02:00[Europe/Oslo]", { min: "2026-03-29T02:30" })).toBe("within");
    });

    it("reads a bound in a fall-back overlap as the earlier instant", () => {
      // Oslo repeats 02:00–03:00 on 2026-10-25: first at +02:00, then at +01:00.
      expect(check("2026-10-25T02:30+02:00[Europe/Oslo]", { max: "2026-10-25T02:30" })).toBe("within");
      expect(check("2026-10-25T02:30+01:00[Europe/Oslo]", { max: "2026-10-25T02:30" })).toBe("overflow");
    });
  });
});
