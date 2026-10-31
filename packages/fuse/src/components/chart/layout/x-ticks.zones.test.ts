import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import slots from "../format/fixtures/slots.json" with { type: "json" };
import type { Interval } from "../format/time-format";
import roboto from "./fixtures/roboto-advances-12px.json" with { type: "json" };
import { advanceOf, labelWidth } from "./label-width";
import { placeCategoryRows, placeTimeRows } from "./x-domain";
import { LABEL_GAP, TICK_BUCKETS, fitsEveryBucket, thinTicks, tickStrides } from "./x-ticks";
import type { TickGeometry } from "./x-ticks";

const domainOf = (interval: Interval, zone: string, starts: readonly string[]) =>
  placeTimeRows(
    starts.map((start) => new Date(start)),
    { interval, timeZone: zone }
  ).domain;

const strideSlots = (interval: Interval, zone: string, starts: readonly string[], stride: number) =>
  tickStrides(domainOf(interval, zone, starts)).find((entry) => entry.stride === stride)?.slots;

describe("wall-clock tick candidates, written by hand", () => {
  const normalDay = slots.hour["Europe/Oslo"]["2025-10-27"].utc_start;
  const fallBack = slots.hour["Europe/Oslo"]["2025-10-26"].utc_start;

  it("puts a 3-hour stride on hours 00, 03 and on to 21", () => {
    expect(strideSlots("hour", "Europe/Oslo", normalDay, 3)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
  });

  it("gives the second repeated 02:00 hour no tick", () => {
    // Slots 2 and 3 both start at 02:00. Even hours then sit at slots 0, 2, 5, 7 and on.
    expect(strideSlots("hour", "Europe/Oslo", fallBack, 1)).toHaveLength(24);
    expect(strideSlots("hour", "Europe/Oslo", fallBack, 1)).not.toContain(3);
    expect(strideSlots("hour", "Europe/Oslo", fallBack, 2)).toEqual([
      0, 2, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23,
    ]);
  });

  it("ticks a quarter-hour axis on whole hours only", () => {
    const quarters = slots["quarter-hour"]["Europe/Oslo"]["2025-10-27"].utc_start;
    expect(strideSlots("quarter-hour", "Europe/Oslo", quarters, 6)).toEqual([0, 24, 48, 72]);
  });

  it("counts day strides from the 1st, so 7 gives the 1st, 8th, 15th, 22nd and 29th", () => {
    const october = slots.day["Europe/Oslo"]["2025-10"].utc_start;
    expect(strideSlots("day", "Europe/Oslo", october, 7)).toEqual([0, 7, 14, 21, 28]);
  });

  it("counts month strides from January", () => {
    const year = slots.month["Europe/Oslo"]["2025"].utc_start;
    expect(strideSlots("month", "Europe/Oslo", year, 3)).toEqual([0, 3, 6, 9]);
  });

  it("counts category strides from the first row", () => {
    const { domain } = placeCategoryRows(Array.from({ length: 10 }, (_, index) => `c${String(index)}`));
    expect(tickStrides(domain).find((entry) => entry.stride === 4)?.slots).toEqual([0, 4, 8]);
  });
});

describe("coarser calendar units", () => {
  // jc4: the committed hourly year, 8,760 hours from 1 October 2025 00:00 in Oslo.
  const yearStarts = Array.from({ length: 8760 }, (_, hour) =>
    new Date(Date.UTC(2025, 8, 30, 22 + hour)).toISOString()
  );
  const domain = domainOf("hour", "Europe/Oslo", yearStarts);
  const tier = (unit: Interval, stride: number) =>
    tickStrides(domain).find((entry) => entry.unit === unit && entry.stride === stride)?.slots;

  it("puts a month start tick on each Oslo midnight of the 1st, past both clock changes", () => {
    // Each start counts the hours from 30 September 22:00 UTC to the 1st's Oslo midnight in UTC.
    // 26 October 2025 has 25 hours and 29 March 2026 has 23, so November is 745 and April 4,368.
    expect(tier("month", 1)).toEqual([0, 745, 1465, 2209, 2953, 3625, 4368, 5088, 5832, 6552, 7296, 8040]);
    expect(tier("month", 3)).toEqual([0, 2209, 4368, 6552]);
    expect(tier("year", 1)).toEqual([2209]);
  });

  it("puts a 14-day stride on midnights of the 1st, 15th and 29th", () => {
    // 15 October is 14 days of 24 hours after 1 October, and 29 October adds the 25-hour 26th.
    expect(tier("day", 14)?.slice(0, 3)).toEqual([0, 336, 673]);
  });

  it("finds no fitting hour stride for a year at any width, so the axis must fall back", () => {
    const hourOnly = tickStrides(domain).filter((entry) => entry.unit === "hour");
    const geometry: TickGeometry = { position: (slot) => (slot + 0.5) / 8760, width: () => 20 };
    expect(fitsEveryBucket(hourOnly, geometry)).toBe(false);
    // At 1,200 px a month is about 99 px wide, so every month start fits. A 29th sits 2 or 3 days
    // before the next 1st, closer than one label and its gap, so no day stride fits any width.
    const shown = thinTicks(tickStrides(domain), geometry);
    expect(shown.filter(({ visibility }) => visibility !== "none").map(({ slot }) => slot)).toEqual([
      0, 745, 1465, 2209, 2953, 3625, 4368, 5088, 5832, 6552, 7296, 8040,
    ]);
  });

  it("finds a fitting hour stride at every width for one day of two-digit labels", () => {
    // 24 hours of 20 px labels: every twelfth hour fits 240 px, so no coarser unit is needed.
    const day = domainOf("hour", "Europe/Oslo", slots.hour["Europe/Oslo"]["2025-10-27"].utc_start);
    const hourOnly = tickStrides(day).filter((entry) => entry.unit === "hour");
    expect(fitsEveryBucket(hourOnly, { position: (slot) => (slot + 0.5) / 24, width: () => 20 })).toBe(true);
  });

  it("thins no strides to no ticks and fits no bucket", () => {
    const geometry: TickGeometry = { position: () => 0, width: () => 20 };
    expect(thinTicks([], geometry)).toEqual([]);
    expect(fitsEveryBucket([], geometry)).toBe(false);
  });

  it("counts a category axis in rows", () => {
    const { domain: rows } = placeCategoryRows(["a", "b"]);
    expect(new Set(tickStrides(rows).map(({ unit }) => unit))).toEqual(new Set(["row"]));
  });

  it("names no coarser unit on a week axis", () => {
    const weeks = Array.from({ length: 4 }, (_, week) =>
      new Date(Date.UTC(2026, 0, 4 + week * 7, 23)).toISOString()
    );
    expect(tickStrides(domainOf("week", "Europe/Oslo", weeks)).every(({ unit }) => unit === "week")).toBe(
      true
    );
  });
});

describe("a label that crowds the first label", () => {
  it("gives way to it, so twelve months from November show below 240 px", () => {
    // Twelve Oslo months from November 2025, with 20 px labels. Month strides count from January,
    // so January sits two slots after the always-shown November. Hand-derived at 120 px, 10 px a
    // slot: November ends at 20 px, so January, starting at 15 px, gives way, and the 6-month
    // stride shows July at 75 px. The 3-month stride's October would clamp to 100 px, 5 px after
    // July ends. At 160 px, 13.3 px a slot, the 3-month stride fits with April at 63.3 px, July at
    // 103.3 px and October clamped to 140 px.
    const starts = Array.from({ length: 12 }, (_, index) =>
      new Date(Date.UTC(2025, 10 + index, 1, index >= 5 && index <= 11 ? -2 : -1)).toISOString()
    );
    const months = tickStrides(domainOf("month", "Europe/Oslo", starts));
    const shown = thinTicks(months, { position: (slot) => (slot + 0.5) / 12, width: () => 20 });
    const at = (slot: number) => shown.find((tick) => tick.slot === slot)?.visibility;
    expect(at(0)).toBe("always");
    expect(at(8)).toBe(120);
    expect(at(5)).toBe(160);
    expect(at(11)).toBe(160);
  });
});

describe("a stride that leaves out the first slot", () => {
  // Twelve slots of 20 px labels at (slot + 0.5) / 12 of the axis. Every slot fits only from
  // 336 px, where a slot is 28 px, the label and the 8 px gap.
  const geometry: TickGeometry = { position: (slot) => (slot + 0.5) / 12, width: () => 20 };
  const every = Array.from({ length: 12 }, (_, slot) => slot);

  it("serves bucket after bucket with the labels the last bucket showed", () => {
    // Hand-derived: at 120 px, slot 5 starts at 45 px and slot 11 clamps to 100 px, so the first
    // slot, then 5 and 11, fit. At 160 to 320 px every slot still crowds its neighbour, and the
    // same two slots hold every label the bucket before showed. At 360 px every slot fits.
    expect(fitsEveryBucket([{ slots: every }, { slots: [5, 11] }], geometry)).toBe(true);
  });
});

describe("a label that the axis's end clamps toward the first label", () => {
  it("gives way until the axis is wide enough for both", () => {
    // Hand-derived: a 64 px first label at 0.1 and a 50 px last label at 0.95. At 120 px the first
    // ends at 64 px, and the last clamps from 89 px to 120 − 50 = 70 px, under 64 + 8. At 160 px it
    // clamps from 127 px to 110 px, which clears 72 px.
    const shown = thinTicks([{ slots: [0, 1] }], {
      position: (slot) => (slot === 0 ? 0.1 : 0.95),
      width: (slot) => (slot === 0 ? 64 : 50),
    });
    expect(shown).toEqual([
      { slot: 0, visibility: "always" },
      { slot: 1, visibility: 160 },
    ]);
  });
});

describe("label-aware thinning", () => {
  const hours = slots.hour["Europe/Oslo"]["2025-10-27"].utc_start;
  const strides = tickStrides(domainOf("hour", "Europe/Oslo", hours));
  const geometry: TickGeometry = {
    position: (slot) => (slot + 0.5) / 24,
    width: () => labelWidth("00"),
  };

  it("shows every sixth hour from 120 px, every third from 200 px and every hour from 560 px", () => {
    // Hand-derived: a two-digit label is 2 × 6.744 px, and with the 8 px gap a neighbour needs
    // 21.488 px. One hour is 5 px at 120 px, so six hours fit, 30 px. At 160 px three hours are
    // 20 px, too few, and at 200 px they are 25 px. Every hour fits from 516 px.
    const shown = thinTicks(strides, geometry);
    const at = (slot: number) => shown.find((tick) => tick.slot === slot)?.visibility;
    expect(at(0)).toBe("always");
    expect(at(6)).toBe(120);
    expect(at(18)).toBe(120);
    expect(at(3)).toBe(200);
    expect(at(21)).toBe(200);
    expect(at(1)).toBe(560);
    expect(at(22)).toBe(560);
  });

  it("never shows fewer labels at a wider bucket and never overlaps them", () => {
    for (const width of [() => labelWidth("00–01"), () => labelWidth("november"), () => 60]) {
      const shown = thinTicks(strides, { ...geometry, width });
      let previousCount = 0;
      for (const bucket of TICK_BUCKETS) {
        const visible = shown.filter(
          ({ visibility }) => visibility === "always" || (visibility !== "none" && visibility <= bucket)
        );
        expect(visible.length).toBeGreaterThanOrEqual(previousCount);
        previousCount = visible.length;
        const boxes = visible.map(({ slot }) => {
          const centre = geometry.position(slot) * bucket;
          const w = width();
          return Math.min(Math.max(centre - w / 2, 0), bucket - w);
        });
        boxes.slice(1).forEach((start, index) => {
          expect(start).toBeGreaterThanOrEqual((boxes[index] ?? 0) + width() + LABEL_GAP - 1e-9);
        });
      }
    }
  });

  it("clamps an edge label inside the axis, which can crowd its neighbour", () => {
    // Hand-derived at 240 px: a 100 px label at the middle spans 70 to 170. A neighbour centred
    // at 228 px would end past the axis, so it clamps to 140 and overlaps. At 280 px the pair
    // spans 90 to 190 and 166 to 266 clamped, which still overlaps, and from 320 px it fits.
    const pair = [{ stride: 1, slots: [0, 1] }];
    const shown = thinTicks(pair, { position: (slot) => (slot === 0 ? 0.5 : 0.95), width: () => 100 });
    expect(shown).toEqual([
      { slot: 0, visibility: "always" },
      { slot: 1, visibility: 320 },
    ]);
  });

  it("fits two labels exactly one gap apart", () => {
    // Hand-derived at 240 px: a 20 px label at 0 spans 0 to 20, so a neighbour starting at 28 px,
    // centred at 38 px, fits with the 8 px gap.
    const pair = [{ stride: 1, slots: [0, 1] }];
    const shown = thinTicks(pair, { position: (slot) => (slot === 0 ? 0 : 38 / 240), width: () => 20 });
    expect(shown[1]).toEqual({ slot: 1, visibility: 240 });
  });

  it("marks a label that fits no bucket as none", () => {
    const shown = thinTicks(strides, { ...geometry, width: () => 2000 });
    expect(shown.filter(({ visibility }) => visibility === "none")).toHaveLength(23);
  });
});

describe("the Roboto advance table", () => {
  // Unit under test: label-width.ts's table. Oracle: the advances that
  // .scratch/charts-v1/tools/l05-oracles/roboto_advances.py reads from Roboto's hmtx table.
  it("matches every advance the font gives at 12 px", () => {
    for (const [character, width] of Object.entries(roboto.advances)) {
      expect([character, advanceOf(character)]).toEqual([character, width]);
    }
  });

  it("falls back to a digit's advance", () => {
    expect(advanceOf("€")).toBe(roboto.fallback);
  });

  it("sums a label's advances", () => {
    expect(labelWidth("kl.")).toBeCloseTo(12.164, 3);
  });
});

describe("chart.css's width buckets", () => {
  // Unit under test: chart.css's container rules. Oracle: TICK_BUCKETS, the widths the thinning
  // assigns, which every rule must reproduce in rem at a 16 px root and hide by the same width.
  it("holds one rem rule per bucket that hides the labels of that bucket", () => {
    const css = readFileSync(new URL("../chart.css", import.meta.url), "utf8");
    const rules = [
      ...css.matchAll(
        /@container chart-x-axis \(width < ([\d.]+)rem\) \{\s*:is\(\[data-slot="chart-x-tick"\], \[data-slot="chart-y-tick"\]\)\[data-min="(\d+)"\]/gu
      ),
    ].map((match) => [Number(match[1]) * 16, Number(match[2])]);
    expect(rules).toEqual(TICK_BUCKETS.map((width) => [width, width]));
  });
});

describe("the always-shown first label", () => {
  it("counts in each fit check, so it never crowds a windowed neighbour", () => {
    // s5 and q14: categories in a window of indices 1 to 11, each label 100 px wide. Stride 2
    // anchors on the even slots, so the first candidate, slot 1, is not among its labels. The
    // oracle is a brute-force overlap check of the clamped boxes at every bucket.
    const strides = [
      { stride: 1, slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { stride: 2, slots: [2, 4, 6, 8, 10] },
      { stride: 4, slots: [4, 8] },
      { stride: 8, slots: [8] },
    ];
    const geometry = { position: (slot: number) => (slot - 1 + 0.5) / 11, width: () => 100 };
    const shown = thinTicks(strides, geometry);
    for (const bucket of TICK_BUCKETS) {
      const boxes = shown
        .filter(
          ({ visibility }) => visibility === "always" || (visibility !== "none" && visibility <= bucket)
        )
        .map(({ slot }) => Math.min(Math.max(geometry.position(slot) * bucket - 50, 0), bucket - 100));
      boxes.slice(1).forEach((start, index) => {
        expect(start, String(bucket)).toBeGreaterThanOrEqual((boxes[index] ?? 0) + 100 + LABEL_GAP - 1e-9);
      });
    }
  });
});
