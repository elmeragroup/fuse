import { describe, expect, it } from "vitest";

import slots from "../format/fixtures/slots.json" with { type: "json" };
import { readSeries, slotTime } from "./readings";
import type { Reading } from "./readings";

const kinds = (readings: readonly Reading[]): string[] =>
  readings.map((reading) => (reading.kind === "reading" ? reading.quality : reading.kind));

describe("section 8.7 quality mapping, written by hand", () => {
  it.each([
    [1.5, undefined, "measured"],
    [1.5, null, "measured"],
    [1.5, "measured", "measured"],
    [1.5, "estimated", "estimated"],
    [1.5, "corrected", "corrected"],
    [0, "missing", "missing"],
    [null, "missing", "missing"],
    [null, "estimated", "missing"],
    [null, "corrected", "missing"],
    [1.5, "E23", "estimated"],
  ] as const)("reads %j with quality %j as %s", (value, quality, expected) => {
    // Three slots, the middle one under test, so a slot with no reading sits inside the span.
    const { readings } = readSeries(
      { values: [1, value, 1], qualities: [null, quality, null] },
      undefined,
      undefined
    );
    expect(kinds(readings)[1]).toBe(expected);
  });

  it("reports the rule each odd cell breaks", () => {
    const { issues } = readSeries(
      {
        values: [Number.NaN, "1,23", 2e15, null, 1],
        qualities: [null, null, null, "estimated", "E23"],
      },
      undefined,
      undefined
    );
    expect(issues).toEqual([
      { rule: "non-finite-value", slot: 0 },
      { rule: "non-finite-value", slot: 1 },
      { rule: "value-out-of-range", slot: 2 },
      { rule: "quality-without-value", slot: 3 },
      { rule: "invalid-quality", slot: 4 },
    ]);
  });

  it("reports no rule for an absent cell or a known quality", () => {
    const { issues } = readSeries(
      { values: [undefined, 1, 2, 3], qualities: [undefined, "estimated", "corrected", "measured"] },
      undefined,
      undefined
    );
    expect(issues).toEqual([]);
  });

  it("reports a corrected quality with no value", () => {
    expect(readSeries({ values: [null], qualities: ["corrected"] }, undefined, undefined).issues).toEqual([
      { rule: "quality-without-value", slot: 0 },
    ]);
  });

  it("reads a value of exactly 1e15 and counts the next double above it as no reading", () => {
    const { readings } = readSeries(
      { values: [1, 1e15, 1e15 + 0.25, 1], qualities: [] },
      undefined,
      undefined
    );
    expect(kinds(readings)).toEqual(["measured", "measured", "missing", "measured"]);
  });

  it("reads a non-finite or out-of-range cell as no reading, never as a value", () => {
    const { readings } = readSeries(
      { values: [1, Number.NaN, 2e15, 1], qualities: [] },
      undefined,
      undefined
    );
    expect(kinds(readings)).toEqual(["measured", "missing", "missing", "measured"]);
  });

  it("reads a broken cell at the series' edge as missing, the fallback section 8.1 names", () => {
    const { readings } = readSeries({ values: [2e15, 1, Number.NaN], qualities: [] }, undefined, undefined);
    expect(kinds(readings)).toEqual(["missing", "measured", "missing"]);
  });

  it("reads −0 as 0", () => {
    const [reading] = readSeries({ values: [-0], qualities: [] }, undefined, undefined).readings;
    expect(reading?.kind === "reading" && Object.is(reading.value, 0)).toBe(true);
  });
});

describe("section 8.6 S07, the month to date", () => {
  // Days 1 to 15 measured, day 5 missing, day 9 corrected, day 16 estimated, days 17 to 31 with no
  // rows, and now at noon on 16 October. Expected by hand: 31 cells, 1 missing marker and 15
  // pending cells.
  const october = slots.day["Europe/Oslo"]["2025-10"].utc_start.map((start) => Date.parse(start));
  const ends = october.map((start, index) => october[index + 1] ?? Date.parse("2025-10-31T23:00:00Z"));
  const values = october.map((_, index) => (index < 16 ? 10 + index : undefined));
  const qualities = october.map((_, index) =>
    index === 4 ? "missing" : index === 8 ? "corrected" : index === 15 ? "estimated" : undefined
  );
  const now = Date.parse("2025-10-16T10:00:00Z");
  const { readings } = readSeries({ values, qualities }, { starts: october, ends }, now);

  it("lists 31 cells", () => {
    expect(readings).toHaveLength(31);
  });

  it("marks day 5 missing, day 9 corrected, day 16 estimated and days 17 to 31 pending", () => {
    const states = kinds(readings);
    expect(states.filter((state) => state === "missing")).toHaveLength(1);
    expect(states[4]).toBe("missing");
    expect(states[8]).toBe("corrected");
    expect(states[15]).toBe("estimated");
    expect(states.filter((state) => state === "pending")).toHaveLength(15);
    expect(states.slice(16).every((state) => state === "pending")).toBe(true);
  });

  it("keeps a slot with no reading inside the span missing", () => {
    const gappy = values.map((value, index) => (index === 2 ? undefined : value));
    expect(kinds(readSeries({ values: gappy, qualities }, { starts: october, ends }, now).readings)[2]).toBe(
      "missing"
    );
  });
});

describe("pending against now, written by hand", () => {
  const starts = [0, 10, 20, 30];
  const ends = [10, 20, 30, 40];

  it("makes a slot that holds now pending, and an ended slot outside the span missing", () => {
    const { readings } = readSeries(
      { values: [undefined, 1, undefined, undefined], qualities: [] },
      { starts, ends },
      25
    );
    expect(kinds(readings)).toEqual(["missing", "measured", "pending", "pending"]);
  });

  it("makes every slot outside the span pending without now", () => {
    const { readings } = readSeries(
      { values: [undefined, 1, undefined, 1, undefined], qualities: [] },
      undefined,
      undefined
    );
    expect(kinds(readings)).toEqual(["pending", "measured", "missing", "measured", "pending"]);
  });

  it("keeps leading slots before the span pending without now", () => {
    const { readings } = readSeries(
      { values: [undefined, undefined, 1, undefined, 1], qualities: [] },
      undefined,
      undefined
    );
    expect(kinds(readings)).toEqual(["pending", "pending", "measured", "missing", "measured"]);
  });

  it("keeps a gap inside the span missing when the axis has slots but no now", () => {
    const { readings } = readSeries(
      { values: [1, undefined, 1], qualities: [] },
      { starts, ends: [10, 20, 30] },
      undefined
    );
    expect(kinds(readings)).toEqual(["measured", "missing", "measured"]);
  });

  it("makes a slot that ended exactly at now missing, not pending", () => {
    // Slot 2 runs from 20 to 30, so with now at 30 it has ended and lies past the span.
    const { readings } = readSeries(
      { values: [1, 1, undefined, undefined], qualities: [] },
      { starts, ends },
      30
    );
    expect(kinds(readings)).toEqual(["measured", "measured", "missing", "pending"]);
  });

  it("treats a series with no reading as pending everywhere without now and missing before now", () => {
    expect(
      kinds(readSeries({ values: [undefined, undefined], qualities: [] }, undefined, undefined).readings)
    ).toEqual(["pending", "pending"]);
    expect(
      kinds(
        readSeries({ values: [undefined, undefined], qualities: [] }, { starts: [0, 10], ends: [10, 20] }, 15)
          .readings
      )
    ).toEqual(["missing", "pending"]);
  });

  it("classifies slots as past, current and future", () => {
    expect([slotTime(0, 10, 10), slotTime(10, 20, 10), slotTime(20, 30, 10)]).toEqual([
      "past",
      "current",
      "future",
    ]);
  });
});
