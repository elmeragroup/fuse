import { describe, expect, it } from "vitest";

/**
 * Unit under test: the zoned hour step, through `cycleSegment` on a zoned draft and
 * `draftToValue` of the stepped draft, as a field's arrow keys use them. Oracle: `@internationalized/date`'s `cycleZoned` for the hour, which React Aria's
 * `IncompleteDate.cycle` uses for a zoned field: it counts whole hours since the epoch between
 * the day's first and last hour, so on Oslo's fall-back night (2026-10-25, 03:00 CEST → 02:00 CET)
 * the 02 hour comes twice, and on its spring-forward night (2026-03-29, 02:00 → 03:00) 02 never
 * comes. The expectations are those instants, written out. Every value names its zone, so they
 * hold in each process zone this file runs in.
 */
import "../../temporal-polyfill";
import { cycleSegment, draftOf, draftToValue } from "./date-draft";

function zoned(text: string): Temporal.ZonedDateTime {
  return Temporal.ZonedDateTime.from(text, { offset: "use" });
}

/** The values a field's hour segment steps through from `start`, `count` steps of `amount`. */
function stepHours(start: string, amount: number, count: number, hourCycle: "h12" | "h23"): string[] {
  const base = zoned(start);
  const seen: string[] = [];
  let draft = draftOf(base, hourCycle);
  for (let index = 0; index < count; index += 1) {
    draft = cycleSegment(draft, "hour", amount, base, hourCycle);
    seen.push(draftToValue(draft, base, hourCycle).toString());
  }
  return seen;
}

describe("a zoned hour stepped across DST", () => {
  it("visits the repeated 02 hour twice on the fall-back night", () => {
    expect(stepHours("2026-10-25T01:30+02:00[Europe/Oslo]", 1, 3, "h23")).toEqual([
      "2026-10-25T02:30:00+02:00[Europe/Oslo]",
      "2026-10-25T02:30:00+01:00[Europe/Oslo]",
      "2026-10-25T03:30:00+01:00[Europe/Oslo]",
    ]);
  });

  it("steps back through both 02 hours", () => {
    expect(stepHours("2026-10-25T03:30+01:00[Europe/Oslo]", -1, 3, "h23")).toEqual([
      "2026-10-25T02:30:00+01:00[Europe/Oslo]",
      "2026-10-25T02:30:00+02:00[Europe/Oslo]",
      "2026-10-25T01:30:00+02:00[Europe/Oslo]",
    ]);
  });

  it("skips the missing 02 hour on the spring-forward night", () => {
    expect(stepHours("2026-03-29T01:30+01:00[Europe/Oslo]", 1, 1, "h23")).toEqual([
      "2026-03-29T03:30:00+02:00[Europe/Oslo]",
    ]);
  });

  it("wraps from the day's last hour to its first", () => {
    expect(stepHours("2026-10-25T23:30+01:00[Europe/Oslo]", 1, 1, "h23")).toEqual([
      "2026-10-25T00:30:00+02:00[Europe/Oslo]",
    ]);
  });

  it("stays in the morning under a 12-hour cycle, wrapping 11 AM to midnight", () => {
    expect(stepHours("2026-10-25T11:30+01:00[Europe/Oslo]", 1, 1, "h12")).toEqual([
      "2026-10-25T00:30:00+02:00[Europe/Oslo]",
    ]);
  });
});

describe("a zoned draft's hour", () => {
  it("keeps the offset of the repeated hour it stepped to, and commits that instant", () => {
    const start = draftOf(zoned("2026-10-25T02:30+02:00[Europe/Oslo]"), "h23");
    const base = zoned("2026-10-25T00:00+02:00[Europe/Oslo]");
    const stepped = cycleSegment(start, "hour", 1, base, "h23");

    expect(stepped).toMatchObject({ hour: 2, offsetNanoseconds: 3_600_000_000_000 });
    expect(draftToValue(stepped, base, "h23").toString()).toBe("2026-10-25T02:30:00+01:00[Europe/Oslo]");
  });

  it("reads a repeated wall clock without a held offset as the earlier instant", () => {
    const draft = {
      ...draftOf(zoned("2026-10-25T01:30+02:00[Europe/Oslo]"), "h23"),
      hour: 2,
      offsetNanoseconds: null,
    };
    expect(draftToValue(draft, zoned("2026-10-25T00:00+02:00[Europe/Oslo]"), "h23").toString()).toBe(
      "2026-10-25T02:30:00+02:00[Europe/Oslo]"
    );
  });
});
