// Unit under test: per-series resolution. Oracles: CONTRACT section 8.8's nesting list, written out
// by hand below; the zoneinfo slot lists of format/fixtures/slots.json, which give 100 quarters and
// 25 hours on Oslo's fall-back day and 92 quarters and 23 hours on its spring-forward day, counted
// by hand from the lists; and row spans counted by hand. The judges in fixtures/slot-judges.ts
// compare every quarter's hour and every hour's day with the lists, under other process zones too.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import slots from "../format/fixtures/slots.json" with { type: "json" };
import type { Interval } from "../format/time-format";
import type { SeriesModel } from "./cartesian-model";
import { coarseSlots, intervalNests, ownWindowFirsts, ownWindowSlots, rowSpans } from "./coarse-slots";

const ALL: readonly Interval[] = ["second", "minute", "quarter-hour", "hour", "day", "week", "month", "year"];

/** Section 8.8: what each Root interval nests in, besides itself. */
const NESTS_IN = {
  second: ["minute", "quarter-hour", "hour", "day", "week", "month", "year"],
  minute: ["quarter-hour", "hour", "day", "week", "month", "year"],
  "quarter-hour": ["hour", "day", "week", "month", "year"],
  hour: ["day", "week", "month", "year"],
  day: ["week", "month", "year"],
  week: [],
  month: ["year"],
  year: [],
} as const satisfies Record<Interval, readonly Interval[]>;

/** The size of each group of equal `first` entries, in order. */
function groupSizes(first: readonly number[]): number[] {
  const sizes: number[] = [];
  first.forEach((owner, slot) => {
    if (owner === slot) sizes.push(1);
    else sizes[sizes.length - 1] = (sizes.at(-1) ?? 0) + 1;
  });
  return sizes;
}

const starts = (list: readonly string[]) => list.map((start) => Date.parse(start));

describe("interval nesting", () => {
  it.each(ALL.flatMap((root) => ALL.map((series) => [root, series] as const)))(
    "decides whether %s nests in %s as section 8.8 lists",
    (root, series) => {
      const coarser: readonly Interval[] = NESTS_IN[root];
      expect(intervalNests(root, series)).toBe(root === series || coarser.includes(series));
    }
  );
});

describe("coarse slots", () => {
  it("groups Oslo's fall-back day into 25 hours of 4 quarters", () => {
    const quarters = starts(slots["quarter-hour"]["Europe/Oslo"]["2025-10-26"].utc_start);
    expect(quarters).toHaveLength(100);
    expect(groupSizes(coarseSlots(quarters, "hour", "Europe/Oslo").first)).toEqual(
      Array.from({ length: 25 }, () => 4)
    );
  });

  it("groups Oslo's spring-forward day into 23 hours of 4 quarters", () => {
    const quarters = starts(slots["quarter-hour"]["Europe/Oslo"]["2026-03-29"].utc_start);
    expect(quarters).toHaveLength(92);
    expect(groupSizes(coarseSlots(quarters, "hour", "Europe/Oslo").first)).toEqual(
      Array.from({ length: 23 }, () => 4)
    );
  });

  it("groups hours into days of 24, 25 and 24 hours around the fall-back day", () => {
    const oslo = slots.hour["Europe/Oslo"];
    const hours = [oslo["2025-10-25"], oslo["2025-10-26"], oslo["2025-10-27"]].flatMap((day) =>
      starts(day.utc_start)
    );
    const coarse = coarseSlots(hours, "day", "Europe/Oslo");
    expect(groupSizes(coarse.first)).toEqual([24, 25, 24]);
    // Every hour knows its day's last hour too.
    expect([coarse.last[0], coarse.last[24], coarse.last[72]]).toEqual([23, 48, 72]);
  });

  it("partitions any run of Root slots into contiguous coarse slots", () => {
    // Hours from a random start in 2025, grouped into days, weeks and months in Oslo.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 360 * 24 }),
        fc.integer({ min: 1, max: 24 * 40 }),
        fc.constantFrom<Interval>("day", "week", "month"),
        (offset, count, interval) => {
          const from = Date.UTC(2025, 0, 1) + offset * 3_600_000;
          const hours = Array.from({ length: count }, (_, index) => from + index * 3_600_000);
          const { first, last } = coarseSlots(hours, interval, "Europe/Oslo");
          hours.forEach((_, slot) => {
            const [own, end] = [first[slot] ?? -1, last[slot] ?? -1];
            expect(own <= slot && slot <= end).toBe(true);
            // Every slot of a group names the same group, and the next slot starts the next one.
            expect([first[own], last[own], first[end], last[end]]).toEqual([own, end, own, end]);
            if (end + 1 < count) expect(first[end + 1]).toBe(end + 1);
          });
        }
      ),
      { numRuns: 60 }
    );
  });
});

describe("Table row spans", () => {
  // Root slots 0 to 7, two hours of 4 quarters.
  const hours = {
    interval: "hour" as const,
    first: [0, 0, 0, 0, 4, 4, 4, 4],
    last: [3, 3, 3, 3, 7, 7, 7, 7],
    // Row spans read only the Root slots, so the instants are the slots' own numbers.
    start: [0, 0, 0, 0, 4, 4, 4, 4],
    end: [4, 4, 4, 4, 8, 8, 8, 8],
  };

  it("spans each hour's cell over its 4 rows", () => {
    expect(rowSpans([0, 1, 2, 3, 4, 5, 6, 7], hours)).toEqual([4, 0, 0, 0, 4, 0, 0, 0]);
  });

  it("spans only the rows the Table lists, as a page or a gap leaves them", () => {
    // The Table lists quarters 2 to 5: two rows of hour 0 and two of hour 1.
    expect(rowSpans([2, 3, 4, 5], hours)).toEqual([2, 0, 2, 0]);
    // A quarter with no row breaks nothing: hour 0's cell covers its listed rows 0 and 3.
    expect(rowSpans([0, 3, 6], hours)).toEqual([2, 0, 1]);
  });
});

describe("own window slots (X2)", () => {
  // Root slots 0 to 7, two hours of 4 quarters, as the row-span fixture above.
  const hourly: SeriesModel = {
    key: "kwh",
    seriesIndex: 0,
    stack: undefined,
    readings: [],
    extents: [],
    projectedFrom: 8,
    coarse: {
      interval: "hour",
      first: [0, 0, 0, 0, 4, 4, 4, 4],
      last: [3, 3, 3, 3, 7, 7, 7, 7],
      start: [0, 0, 0, 0, 4, 4, 4, 4],
      end: [4, 4, 4, 4, 8, 8, 8, 8],
    },
  };

  it("visits each hour once, at its first quarter inside the window", () => {
    expect(ownWindowSlots(hourly, { first: 0, last: 7 })).toEqual([0, 4]);
    // A window from quarter 2 holds hour 0 from its third quarter.
    expect(ownWindowSlots(hourly, { first: 2, last: 5 })).toEqual([2, 4]);
    expect(ownWindowSlots(hourly, { first: 5, last: 7 })).toEqual([5]);
  });

  it("walks each hour's first quarter, before the window when it starts inside an hour (Y4)", () => {
    expect(ownWindowFirsts(hourly, { first: 0, last: 7 })).toEqual([0, 4]);
    expect(ownWindowFirsts(hourly, { first: 2, last: 5 })).toEqual([0, 4]);
    expect(ownWindowFirsts(hourly, { first: 5, last: 7 })).toEqual([4]);
  });

  it("visits every Root slot of a series at Root's interval", () => {
    expect(ownWindowSlots({ ...hourly, coarse: undefined }, { first: 2, last: 5 })).toEqual([2, 3, 4, 5]);
  });
});
