import fc from "fast-check";
import { describe, expect, it } from "vitest";

import year from "../format/fixtures/elhub/no1-household-hourly-2025-10_2026-09.json" with { type: "json" };
import { BUCKETS, DECIMATE_ABOVE, bucketEdges, m4Indexes } from "./decimate";

/** The brute-force oracle: each bucket's lowest and highest reading over the raw rows. */
function bucketExtremes(values: readonly (number | null)[]): ({ low: number; high: number } | undefined)[] {
  const extremes: ({ low: number; high: number } | undefined)[] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    const bucket = Math.floor((index * BUCKETS) / values.length);
    const entry = extremes[bucket] ?? { low: value, high: value };
    extremes[bucket] = { low: Math.min(entry.low, value), high: Math.max(entry.high, value) };
  });
  return extremes;
}

describe("M4 decimation over the committed hourly year", () => {
  const values = year.values;

  it("holds 8,760 hours", () => {
    expect(values).toHaveLength(8760);
  });

  it("keeps every bucket's lowest and highest reading among the drawn vertices", () => {
    const kept = m4Indexes(values);
    const drawn = new Set(kept.map((index) => values[index]));
    for (const entry of bucketExtremes(values)) {
      expect(entry !== undefined && drawn.has(entry.low) && drawn.has(entry.high)).toBe(true);
    }
  });

  it("draws at most 2,000 vertices in x order", () => {
    const kept = m4Indexes(values);
    expect(kept.length).toBeLessThanOrEqual(DECIMATE_ABOVE);
    expect([...kept].sort((a, b) => a - b)).toEqual(kept);
  });

  it("keeps the year's 0.5875 low and 3.7574 high", () => {
    // Printed by trim_elhub_year.py: the low at index 6965 and the high at index 2467.
    const kept = new Set(m4Indexes(values));
    expect(kept.has(6965)).toBe(true);
    expect(kept.has(2467)).toBe(true);
  });
});

describe("M4 rules, written by hand", () => {
  it("leaves a window of 2,000 slots or fewer whole, apart from the slots with no reading", () => {
    expect(m4Indexes([1, null, 3])).toEqual([0, 2]);
  });

  it("splits by slot index into 500 buckets", () => {
    const edges = bucketEdges(2001);
    expect(edges).toHaveLength(501);
    expect(edges[0]).toBe(0);
    expect(edges.at(-1)).toBe(2001);
  });

  it("leaves exactly 2,000 slots whole, where M4 would drop a flat bucket's middle", () => {
    expect(m4Indexes(Array.from({ length: 2000 }, () => 5))).toHaveLength(2000);
  });

  it("keeps each bucket's first and last reading beside its extremes", () => {
    // 2,500 slots give 5 per bucket: first 3 at 0, low 1 at 1, high 5 at 3 and last 4 at 4.
    const values = Array.from({ length: 2500 }, (_, index) =>
      index < 5 ? ([3, 1, 2, 5, 4][index] ?? 0) : 0
    );
    expect(m4Indexes(values).filter((index) => index < 5)).toEqual([0, 1, 3, 4]);
  });

  it("keeps the first occurrence of a tied low", () => {
    const values = Array.from({ length: 2500 }, (_, index) =>
      index < 5 ? ([2, 1, 9, 1, 3][index] ?? 0) : 0
    );
    expect(m4Indexes(values).filter((index) => index < 5)).toEqual([0, 1, 2, 4]);
  });

  it("keeps nothing from a bucket with no reading", () => {
    const values = Array.from({ length: 2500 }, (_, index) => (index < 5 ? null : 1));
    const kept = m4Indexes(values);
    expect(kept.filter((index) => index < 5)).toEqual([]);
    expect(kept[0]).toBe(5);
  });

  it("keeps the first occurrence of a tied extreme", () => {
    // 2,500 slots give 5 per bucket. The first bucket's values tie at their high.
    const values = Array.from({ length: 2500 }, (_, index) =>
      index < 5 ? ([1, 9, 9, 2, 3][index] ?? 0) : 0
    );
    expect(m4Indexes(values).filter((index) => index < 5)).toEqual([0, 1, 4]);
  });

  it("keeps each bucket's extremes for any series, as a property", () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.integer({ min: -500, max: 500 }), { nil: null, freq: 10 }), {
          minLength: 2001,
          maxLength: 3000,
        }),
        (values) => {
          const drawn = new Set(m4Indexes(values).map((index) => values[index]));
          for (const entry of bucketExtremes(values)) {
            if (entry === undefined) continue;
            expect(drawn.has(entry.low) && drawn.has(entry.high)).toBe(true);
          }
        }
      ),
      { seed: 20261018, numRuns: 30 }
    );
  });
});
