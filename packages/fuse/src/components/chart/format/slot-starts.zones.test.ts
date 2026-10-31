/**
 * Unit under test: `slotStart`, the one rule that places every slot. Oracle: `slot-starts.json`,
 * which `slot_starts.py` writes from Python's zoneinfo on tzdata 2025c by scanning UTC instants for
 * each local day start, sharing no code with Fuse. It holds 1,528 instants in 19 zones, around
 * every offset change from 2018 to 2025 in 17 of them, Toronto's two 1919 changes and Monrovia's
 * 1972 change from its −00:44:30 offset, with the start of each of eight slots. The hand-written
 * labels for the same zone changes run in every engine, as the slot-start judge in
 * `fixtures/time-judges.ts`.
 */
import { describe, expect, it } from "vitest";

import oracle from "./fixtures/slot-starts.json" with { type: "json" };
import { slotStart } from "./time-format";
import type { Interval } from "./time-format";

/** The oracle's interval names in its column order, mapped to Fuse's. */
const COLUMNS: readonly Interval[] = [
  "second",
  "minute",
  "quarter-hour",
  "hour",
  "day",
  "week",
  "month",
  "year",
];

describe("slotStart against the zoneinfo slot-start oracle", () => {
  it("names the oracle's columns as Fuse's intervals", () => {
    expect(oracle.meta.interval_order).toEqual([
      "second",
      "minute",
      "quarter",
      "hour",
      "day",
      "week",
      "month",
      "year",
    ]);
  });

  it.each(Object.entries(oracle.zones))("places every sampled slot in %s", (zone, rows) => {
    const failures: string[] = [];
    for (const [at, ...starts] of rows) {
      if (at === undefined) continue;
      COLUMNS.forEach((interval, column) => {
        const expected = starts[column];
        const actual = slotStart(at, interval, zone);
        if (actual !== expected) {
          failures.push(
            `${zone} ${new Date(at).toISOString()} ${interval}: expected ${expected === undefined ? "none" : new Date(expected).toISOString()}, got ${new Date(actual).toISOString()}`
          );
        }
      });
    }
    expect(rows.length).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });
});
