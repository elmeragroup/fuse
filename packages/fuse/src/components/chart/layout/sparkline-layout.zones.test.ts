// The Sparkline's layout and range sentence, after ticket 06's F4. Unit under test:
// sparklineLayout, emphasisIndex and sparklineSentence. Oracles: hand-written domains and paths in
// the 10-unit cells of a 100-unit-high viewBox, and spoken slot labels copied from the pattern of
// format/fixtures/time-literals.ts' "afternoon hour range" case, with U+00A0 between the words.
import { describe, expect, it } from "vitest";

import { emphasisIndex, sparklineLayout, sparklineSentence } from "./sparkline-layout";

const base = { variant: "line", curve: "linear", emphasis: undefined, reference: undefined } as const;

describe("sparklineLayout", () => {
  it("spans a line over the values' own range, one value per cell", () => {
    const layout = sparklineLayout({ ...base, data: [2, 6, 4] });
    expect(layout.viewBox).toBe("0 0 30 100");
    // 2 sits at the bottom and 6 at the top.
    expect(layout.mark).toBe("M5,100L15,0L25,50");
    expect(layout.zero).toBeNull();
  });

  it("reaches 0 for an area and draws a zero line only where the values cross 0", () => {
    expect(sparklineLayout({ ...base, variant: "area", data: [2, 4] }).mark).toBe("M5,50L15,0L15,100L5,100Z");
    expect(sparklineLayout({ ...base, data: [-1, 3] }).zero).toBe("M0,75H20");
    expect(sparklineLayout({ ...base, variant: "bar", data: [2, 4] }).zero).toBeNull();
  });

  it("widens a flat line by a tenth of its value, so it sits mid-box", () => {
    expect(sparklineLayout({ ...base, data: [0.4, 0.4] }).mark).toBe("M5,50L15,50");
  });

  it("joins the reference to the domain, as a dashed flat line", () => {
    const layout = sparklineLayout({ ...base, data: [2, 4], reference: 6 });
    expect(layout.reference).toBe("M0,0H20");
    expect(layout.mark).toBe("M5,100L15,50");
  });

  it("draws an area's lone readings as round caps beside its empty fill (B2-1)", () => {
    // [10, null, 20] over [0, 20]: 10 sits mid-box in the first cell and 20 at the top of the third.
    const layout = sparklineLayout({ ...base, variant: "area", data: [10, null, 20] });
    expect([layout.mark, layout.lone]).toEqual(["", "M5,50ZM25,0Z"]);
    expect(sparklineLayout({ ...base, variant: "area", data: [2, 4] }).lone).toBe("");
  });

  it("draws a lone reading as a round cap and nothing with no reading", () => {
    expect(sparklineLayout({ ...base, data: [1, null, 3] }).mark).toBe("M5,100ZM25,0Z");
    expect(sparklineLayout({ ...base, data: [null, null] }).mark).toBe("");
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
