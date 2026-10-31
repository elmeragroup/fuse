import { describe, expect, it } from "vitest";

import fallBack from "../format/fixtures/elhub/no1-consumption-2025-10-26.json" with { type: "json" };
import spring from "../format/fixtures/elhub/no1-consumption-2026-03-29.json" with { type: "json" };
import production from "../format/fixtures/elhub/no1-production-15min-2025-10-26.json" with { type: "json" };
import quarters from "../format/fixtures/prices/fall-back-2025-10-26-quarter.json" with { type: "json" };
import slots from "../format/fixtures/slots.json" with { type: "json" };
import { spawnZoneProbe } from "../format/fixtures/spawn-zone-probe";
import { slotJudgements } from "./fixtures/slot-judges";
import { instantOf, placeCategoryRows, placeTimeRows, projectedSlot, slotOf, slotX } from "./x-domain";
import type { XDomain } from "./x-domain";

// Unit under test: placeTimeRows. Oracle: the zoneinfo slot lists in slots.json, which the charts
// ground truth wrote with Python's zoneinfo, and the counts of CONTRACT section 8.6.

const instants = (list: readonly string[]): number[] => list.map((start) => Date.parse(start));
const household = (rows: readonly { readonly consumptionGroup: string; readonly startTime: string }[]) =>
  rows.filter((row) => row.consumptionGroup === "household").map((row) => new Date(row.startTime));

describe("slots from rows", () => {
  it("lists the 25 Oslo hours of the fall-back day, placed by start", () => {
    const { domain, issues } = placeTimeRows(household(fallBack.rows), {
      interval: "hour",
      timeZone: "Europe/Oslo",
    });
    expect(issues).toEqual([]);
    expect(domain.kind === "time" && domain.starts).toEqual(
      instants(slots.hour["Europe/Oslo"]["2025-10-26"].utc_start)
    );
  });

  it("lists the 23 Oslo hours of the spring day", () => {
    const { domain } = placeTimeRows(household(spring.rows), { interval: "hour", timeZone: "Europe/Oslo" });
    expect(domain.kind === "time" && domain.starts).toEqual(
      instants(slots.hour["Europe/Oslo"]["2026-03-29"].utc_start)
    );
  });

  it("places 100 Oslo quarters of production by start", () => {
    const { domain } = placeTimeRows(
      production.rows.map((row) => new Date(row.startTime)),
      { interval: "quarter-hour", timeZone: "Europe/Oslo" }
    );
    expect(domain.kind === "time" && domain.starts).toEqual(
      instants(slots["quarter-hour"]["Europe/Oslo"]["2025-10-26"].utc_start)
    );
  });

  it("ignores the 75-minute end of the hand-written fall-back quarter and places 100 Stockholm quarters", () => {
    const { domain, issues } = placeTimeRows(
      quarters.map((row) => new Date(row.time_start)),
      { interval: "quarter-hour", timeZone: "Europe/Stockholm" }
    );
    expect(issues).toEqual([]);
    expect(domain.kind === "time" && domain.starts).toEqual(
      instants(slots["quarter-hour"]["Europe/Stockholm"]["2025-10-26"].utc_start)
    );
  });

  it("orders rows by instant, where ISO text would misorder the repeated hour", () => {
    const shuffled = household(fallBack.rows).reverse();
    const { domain, rowAt } = placeTimeRows(shuffled, { interval: "hour", timeZone: "Europe/Oslo" });
    expect(domain.kind === "time" && domain.starts.length).toBe(25);
    expect(rowAt[0]).toBe(24);
  });

  it("keeps a gap visible as a slot with no row", () => {
    const rows = household(fallBack.rows).filter((_, index) => index !== 3);
    const { domain, rowAt } = placeTimeRows(rows, { interval: "hour", timeZone: "Europe/Oslo" });
    expect(domain.kind === "time" && domain.starts.length).toBe(25);
    expect(rowAt[3]).toBeUndefined();
  });
});

describe("slots from a period", () => {
  it("lists every day of October 2025 in Oslo, 31 slots past the last row", () => {
    const { domain } = placeTimeRows([new Date("2025-09-30T22:00:00Z")], {
      interval: "day",
      timeZone: "Europe/Oslo",
      period: [Date.parse("2025-09-30T22:00:00Z"), Date.parse("2025-10-31T23:00:00Z")],
    });
    expect(domain.kind === "time" && domain.starts).toEqual(
      instants(slots.day["Europe/Oslo"]["2025-10"].utc_start)
    );
  });

  it("lists 745 hours in October 2025 in Oslo", () => {
    const { domain } = placeTimeRows([], {
      interval: "hour",
      timeZone: "Europe/Oslo",
      period: [Date.parse("2025-09-30T22:00:00Z"), Date.parse("2025-10-31T23:00:00Z")],
    });
    expect(domain.kind === "time" && domain.starts.length).toBe(745);
  });

  it("lists the 12 Oslo months of 2025", () => {
    const { domain } = placeTimeRows([], {
      interval: "month",
      timeZone: "Europe/Oslo",
      period: [Date.parse("2024-12-31T23:00:00Z"), Date.parse("2025-12-31T23:00:00Z")],
    });
    expect(domain.kind === "time" && domain.starts).toEqual(
      instants(slots.month["Europe/Oslo"]["2025"].utc_start)
    );
  });

  it("drops a row outside the period", () => {
    const { issues } = placeTimeRows([new Date("2025-11-01T00:00:00Z")], {
      interval: "day",
      timeZone: "Europe/Oslo",
      period: [Date.parse("2025-09-30T22:00:00Z"), Date.parse("2025-10-31T23:00:00Z")],
    });
    expect(issues).toEqual([{ rule: "row-outside-period", row: 0 }]);
  });
});

describe("rows off the grid and bad rows", () => {
  it("moves a day stored as UTC midnight into the Oslo day of the same date", () => {
    // Hand-written from slots-daily.json: 2025-10-16 starts at 2025-10-15T22:00Z in Oslo, so
    // 2025-10-16T00:00Z lies two hours into that day.
    const { domain, issues } = placeTimeRows([new Date("2025-10-16T00:00:00Z")], {
      interval: "day",
      timeZone: "Europe/Oslo",
    });
    expect(issues).toEqual([{ rule: "off-grid-x", row: 0 }]);
    expect(domain.kind === "time" && domain.starts).toEqual([Date.parse("2025-10-15T22:00:00Z")]);
  });

  it("moves the same row into the previous day under America/New_York", () => {
    // New York is at UTC−4 in October, so 2025-10-16T00:00Z is 20:00 on 15 October.
    const { domain } = placeTimeRows([new Date("2025-10-16T00:00:00Z")], {
      interval: "day",
      timeZone: "America/New_York",
    });
    expect(domain.kind === "time" && domain.starts).toEqual([Date.parse("2025-10-15T04:00:00Z")]);
  });

  it("drops an invalid instant and a string, and keeps the first of two rows on one slot", () => {
    const { rowAt, issues } = placeTimeRows(
      [new Date("2025-10-16T22:00:00Z"), new Date("invalid"), "2025-10-16", new Date("2025-10-16T22:00:00Z")],
      { interval: "day", timeZone: "Europe/Oslo" }
    );
    expect(rowAt).toEqual([0]);
    expect(issues).toEqual([
      { rule: "invalid-x", row: 1 },
      { rule: "invalid-x", row: 2 },
      { rule: "duplicate-x", row: 3 },
    ]);
  });

  it("reads epoch milliseconds as instants", () => {
    const { domain } = placeTimeRows([Date.parse("2025-10-16T22:00:00Z")], {
      interval: "day",
      timeZone: "Europe/Oslo",
    });
    expect(slotX(domain, 0)).toEqual(new Date("2025-10-16T22:00:00Z"));
  });
});

describe("instants", () => {
  it.each([
    [new Date("2025-10-16T22:00:00Z"), Date.parse("2025-10-16T22:00:00Z")],
    [5, 5],
    ["2025-10-16", Number.NaN],
    [undefined, Number.NaN],
    [null, Number.NaN],
    [Number.POSITIVE_INFINITY, Number.NaN],
    [new Date(Number.NaN), Number.NaN],
  ] as const)("reads %j as %d", (cell, expected) => {
    expect(instantOf(cell)).toBe(expected);
  });
});

describe("periods and their edges", () => {
  const oslo = { interval: "day", timeZone: "Europe/Oslo" } as const;

  it("starts at the first whole slot of a period that begins mid-slot", () => {
    const { domain } = placeTimeRows([], {
      ...oslo,
      period: [Date.parse("2025-10-01T03:00:00Z"), Date.parse("2025-10-02T22:00:00Z")],
    });
    expect(domain.kind === "time" && domain.starts).toEqual([Date.parse("2025-10-01T22:00:00Z")]);
  });

  it("drops a row before the period and a row at its end, which the period leaves out", () => {
    const period = [Date.parse("2025-09-30T22:00:00Z"), Date.parse("2025-10-31T23:00:00Z")] as const;
    const { issues } = placeTimeRows([new Date("2025-09-29T22:00:00Z"), new Date("2025-10-31T23:00:00Z")], {
      ...oslo,
      period,
    });
    expect(issues).toEqual([
      { rule: "row-outside-period", row: 0 },
      { rule: "row-outside-period", row: 1 },
    ]);
  });

  it("lists issues in row order", () => {
    const { issues } = placeTimeRows(
      [new Date("2025-10-16T22:00:00Z"), new Date("2025-10-16T22:00:00Z"), "x"],
      oslo
    );
    expect(issues).toEqual([
      { rule: "duplicate-x", row: 1 },
      { rule: "invalid-x", row: 2 },
    ]);
  });
});

describe("category axes and lookups", () => {
  it("finds no category for a cell that is not a string, and reports a category as its x", () => {
    const { domain } = placeCategoryRows(["a", "b"]);
    expect(slotOf(domain, 5)).toBe(-1);
    expect(slotOf(domain, "b")).toBe(1);
    expect(slotX(domain, 1)).toBe("b");
  });

  it("keeps data order and the first of two equal categories", () => {
    const { domain, rowAt, issues } = placeCategoryRows(["Jan", "Feb", "Jan", 3]);
    expect(domain).toEqual({ kind: "category", names: ["Jan", "Feb"] });
    expect(rowAt).toEqual([0, 1]);
    expect(issues).toEqual([
      { rule: "duplicate-x", row: 2 },
      { rule: "invalid-x", row: 3 },
    ]);
  });

  it("finds a slot by any instant inside it, and nothing outside the domain", () => {
    const { domain } = placeTimeRows(household(fallBack.rows), { interval: "hour", timeZone: "Europe/Oslo" });
    // The second 02:00 hour starts at 01:00Z, so 01:59:59.999Z still lies in it.
    expect(slotOf(domain, new Date("2025-10-26T01:59:59.999Z"))).toBe(3);
    expect(slotOf(domain, new Date("2025-10-27T00:00:00Z"))).toBe(-1);
    expect(slotOf(domain, "02:00")).toBe(-1);
  });
});

// Each child starts now, so both run beside each other and beside this file's tests.
const ZONE_PROBES = ["America/New_York", "Asia/Tokyo"].map(
  (zone) => [zone, spawnZoneProbe(new URL("./fixtures/zone-probe.ts", import.meta.url), zone)] as const
);

describe("every zoneinfo slot list", () => {
  it.each(slotJudgements().map((judgement) => [judgement.name, judgement] as const))("%s", (_, judgement) => {
    expect(judgement.actual).toEqual(judgement.expected);
  });

  it.each(ZONE_PROBES)("matches every list when the process runs in %s", async (zone, output) => {
    expect(JSON.parse(await output)).toEqual({ zone, mismatches: [] });
  });
});

describe("projectedSlot", () => {
  // Slots written by hand: [0, 10), [10, 20) and [20, 30) on a time axis, and two categories.
  const time: XDomain = {
    kind: "time",
    interval: "hour",
    timeZone: "UTC",
    starts: [0, 10, 20],
    ends: [10, 20, 30],
  };
  const categories: XDomain = { kind: "category", names: ["a", "b"] };

  it.each([
    ["no x", undefined, 3],
    ["an x before the domain", -5, 0],
    ["an x inside the second slot", 15, 1],
    ["an x at a slot start", 20, 2],
    ["an x after the domain", 30, 3],
    ["an invalid date", new Date(Number.NaN), 3],
  ] as const)("finds the first projected slot for %s on a time axis", (_, x, slot) => {
    expect(projectedSlot(time, x)).toBe(slot);
  });

  it("matches categories exactly, and projects nothing for one the axis lacks", () => {
    expect(projectedSlot(categories, "b")).toBe(1);
    expect(projectedSlot(categories, "z")).toBe(2);
  });
});
