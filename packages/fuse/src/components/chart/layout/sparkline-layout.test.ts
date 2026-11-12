// The Sparkline's layout and range sentence, after ticket 06's F4. Unit under test:
// sparklineLayout, emphasisIndex and sparklineSentence. Oracles: hand-written domains and paths in
// the 10-unit cells of a 100-unit-high viewBox, hand-worked percentages of the box for the bars,
// rules, dots and hover regions, and spoken slot labels copied from the pattern of
// format/fixtures/time-literals.ts' "afternoon hour range" case, with U+00A0 between the words.
import { describe, expect, it } from "vitest";

import type { ChartCurve } from "../chart-types";
import { emphasisIndex, sparklineLayout, sparklineSentence } from "./sparkline-layout";
import type { SparklineInput, SparklineLayout } from "./sparkline-layout";

const base = { variant: "line", curve: "linear", emphasis: undefined, reference: undefined } as const;

/** The layout of a line or an area, which draws paths. */
function paths(input: SparklineInput): Extract<SparklineLayout, { kind: "path" }> {
  const layout = sparklineLayout(input);
  if (layout.kind !== "path") throw new Error(`a ${input.variant} laid out as ${layout.kind}`);
  return layout;
}

/** The layout of bars. */
function bars(input: SparklineInput): Extract<SparklineLayout, { kind: "bars" }> {
  const layout = sparklineLayout(input);
  if (layout.kind !== "bars") throw new Error(`a ${input.variant} laid out as ${layout.kind}`);
  return layout;
}

describe("sparklineLayout", () => {
  it("spans a line over the values' own range, one value per cell", () => {
    const layout = paths({ ...base, data: [2, 6, 4] });
    expect(layout.viewBox).toBe("0 0 30 100");
    // 2 sits at the bottom and 6 at the top.
    expect([layout.stroke, layout.fill]).toEqual(["M5,100L15,0L25,50", ""]);
    expect(layout.zero).toBeNull();
  });

  it("fills an area to 0 under a stroked top edge, and draws a zero line only where the values cross 0", () => {
    const area = paths({ ...base, variant: "area", data: [2, 4] });
    expect([area.fill, area.stroke]).toEqual(["M5,50L15,0L15,100L5,100Z", "M5,50L15,0"]);
    // [-1, 3]: 0 sits three quarters of the way down.
    expect(paths({ ...base, data: [-1, 3] }).zero).toBe(75);
    expect(bars({ ...base, variant: "bar", data: [2, 4] }).zero).toBeNull();
  });

  it("widens a flat line by a tenth of its value, so it sits mid-box", () => {
    expect(paths({ ...base, data: [0.4, 0.4] }).stroke).toBe("M5,50L15,50");
  });

  it("joins the reference to the domain, as a flat line at the top", () => {
    const layout = paths({ ...base, data: [2, 4], reference: 6 });
    expect(layout.reference).toBe(0);
    expect(layout.stroke).toBe("M5,100L15,50");
  });

  it("draws an area's lone readings as round caps on its edge beside its empty fill (B2-1)", () => {
    // [10, null, 20] over [0, 20]: 10 sits mid-box in the first cell and 20 at the top of the third.
    const layout = paths({ ...base, variant: "area", data: [10, null, 20] });
    expect([layout.fill, layout.stroke]).toEqual(["", "M5,50ZM25,0Z"]);
  });

  it("draws a lone reading as a round cap and nothing with no reading", () => {
    expect(paths({ ...base, data: [1, null, 3] }).stroke).toBe("M5,100ZM25,0Z");
    const empty = paths({ ...base, data: [null, null] });
    expect([empty.stroke, empty.readings, empty.zero]).toEqual(["", [], null]);
  });

  it("places the emphasis dot by percentages of the box", () => {
    // The highest of three values is the middle one, at the top of the box.
    expect(paths({ ...base, data: [2, 6, 4], emphasis: "max" }).dot).toEqual({ x: 50, y: 0 });
    expect(paths({ ...base, data: [2, 6, 4] }).dot).toBeNull();
  });

  it("gives each reading its cell and a band from the centre before it to the centre after it", () => {
    // Three cells a third of the box wide. The end bands reach a tenth past the box.
    const layout = paths({ ...base, data: [2, 6, 4] });
    expect(layout.readings.map(({ index, x, y, cell, band }) => ({ index, x, y, cell, band }))).toEqual([
      { index: 0, x: 16.667, y: 100, cell: [0, 33.333], band: [-10, 50] },
      { index: 1, x: 50, y: 0, cell: [33.333, 66.667], band: [16.667, 83.333] },
      { index: 2, x: 83.333, y: 50, cell: [66.667, 100], band: [50, 110] },
    ]);
    // A missing value takes no hover region.
    expect(paths({ ...base, data: [1, null, 3] }).readings.map(({ index }) => index)).toEqual([0, 2]);
  });

  it("re-strokes the full line's own curve between the readings around a hovered one, for every curve", () => {
    // Unit: each reading's segment. Oracle: the full line, whose commands inside a reading's band,
    // from the reading before to the one after, the segment must repeat, so the highlight lies on
    // the line it re-strokes. Every curve but the natural spline joins its readings from the
    // neighbours either side of a span, so its segment repeats them exactly. The natural spline
    // shapes each span from every reading, so it may differ by under a pixel of a 2rem box, 32 px
    // over the viewBox's 100 units.
    const tolerance = {
      linear: 0,
      monotone: 0,
      "monotone-y": 0,
      natural: 100 / 32,
      step: 0,
      "step-before": 0,
      "step-after": 0,
      bump: 0,
      basis: 0,
    } as const satisfies Record<ChartCurve, number>;
    const data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7];
    /** The commands of a path that end inside a reading's band, each as its letter and numbers. */
    const inBand = (path: string, index: number) =>
      (path.match(/[A-Z][^A-Z]*/gu) ?? []).flatMap((command) => {
        const numbers = command.slice(1).split(/[ ,]/u).filter(Boolean).map(Number);
        const end = numbers.at(-2) ?? Number.NaN;
        const inside = !command.startsWith("M") && end > (index - 0.5) * 10 && end <= (index + 1.5) * 10;
        return inside ? [{ letter: command[0], numbers }] : [];
      });
    // SAFETY: `tolerance` satisfies Record<ChartCurve, number>, so its keys are exactly the curves.
    for (const [curve, within] of Object.entries(tolerance) as [ChartCurve, number][]) {
      const layout = paths({ ...base, curve, data });
      for (const { index, segment } of layout.readings) {
        const label = `${curve} at ${String(index)}`;
        const own = inBand(segment, index);
        const full = inBand(layout.stroke, index);
        expect(own.length, label).toBeGreaterThan(0);
        if (within === 0) {
          expect(own, label).toEqual(full);
          continue;
        }
        expect(
          own.map(({ letter }) => letter),
          label
        ).toEqual(full.map(({ letter }) => letter));
        const drift = own.flatMap(({ numbers }, at) =>
          numbers.map((value, place) => Math.abs(value - (full[at]?.numbers[place] ?? Number.NaN)))
        );
        expect(Math.max(...drift), label).toBeLessThan(within);
      }
    }
  });

  it("puts 0 where an area fades to, down the view box, whichever readings draw fill", () => {
    expect(paths({ ...base, variant: "area", data: [2, 4] }).fillZero).toBe(100);
    expect(paths({ ...base, variant: "area", data: [-4, -4] }).fillZero).toBe(0);
    // [-1, 3] with a reference at 7 spans [-1, 7], so 0 sits seven eighths of the way down.
    expect(paths({ ...base, variant: "area", data: [-1, 3], reference: 7 }).fillZero).toBe(87.5);
    // [1, 2, null, -10] spans [-10, 2], so 0 sits a sixth of the way down, though the lone -10
    // draws no fill.
    expect(paths({ ...base, variant: "area", data: [1, 2, null, -10] }).fillZero).toBe(16.667);
    // [-4, null, 2, 4] spans [-4, 4], so 0 sits halfway down, though only 2 and 4 draw fill.
    expect(paths({ ...base, variant: "area", data: [-4, null, 2, 4] }).fillZero).toBe(50);
  });

  it("places bars by percentages of an unstretched box, a negative one hanging from 0", () => {
    // [2, -2] spans [-2, 2], so 0 sits mid-box. Each cell is half the box, and its bar three
    // quarters of the cell, centred.
    const layout = bars({ ...base, variant: "bar", data: [2, -2] });
    expect(layout).not.toHaveProperty("viewBox");
    expect(layout.zero).toBe(50);
    expect(layout.readings.map(({ bar, negative }) => ({ bar, negative }))).toEqual([
      { bar: { x: 6.25, y: 0, width: 37.5, height: 50 }, negative: false },
      { bar: { x: 56.25, y: 50, width: 37.5, height: 50 }, negative: true },
    ]);
  });

  it("picks the first of tied extremes for the dot", () => {
    expect(emphasisIndex([3, 1, 3, 1], "max")).toBe(0);
    expect(emphasisIndex([3, 1, 3, 1], "min")).toBe(1);
    expect(emphasisIndex([null, 2, 5, null], "last")).toBe(2);
    expect(emphasisIndex([null, 2], 0)).toBe(-1);
  });
});

describe("sparklineSentence", () => {
  it("names the lowest and highest values and their slots in nb-NO", () => {
    // Three hours from 14:00 in Oslo on 17 October 2026, which is UTC+2.
    const sentence = sparklineSentence("nb-NO", [30, 23, 178], undefined, {
      start: Date.UTC(2026, 9, 17, 12),
      interval: "hour",
      timeZone: "Europe/Oslo",
    });
    expect(sentence).toBe("Lavest 23 kl. 15 til 16, høyest 178 kl. 16 til 17.");
  });

  it("names the values alone without a start, and the first of tied lows", () => {
    expect(sparklineSentence("en-US", [4, 1, 9, 1], undefined, undefined)).toBe("Lowest 1, highest 9.");
  });

  it("reads the dictionary's noData with no value", () => {
    expect(sparklineSentence("nb-NO", [null], undefined, undefined)).toBe("Ingen data for perioden.");
  });
});
