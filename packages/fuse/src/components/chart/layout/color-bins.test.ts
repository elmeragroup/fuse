import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { colorBins } from "./color-bins";
import { escapeColorKey, seriesPaint } from "./color-key";

describe("section 8.9 bins, written by hand", () => {
  it("bins a diverging series by sevenths of its largest magnitude", () => {
    // M = 7, so the edges sit at 1, 3 and 5 in magnitude.
    const bins = colorBins("chart-diverging", [-7, 0, 7]);
    const table = [-7, -5, -4.99, -3, -2.99, -1, -0.99, 0, 0.99, 1, 2.99, 3, 4.99, 5, 7].map(bins);
    expect(table).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 7]);
  });

  it("bins a sequential series into 7 equal steps over its extent", () => {
    const bins = colorBins("chart-seq", [0, 7]);
    expect([0, 0.99, 1, 3.5, 6.99, 7].map(bins)).toEqual([1, 1, 2, 4, 7, 7]);
  });

  it("bins over an extent that does not start at 0", () => {
    // Over [10, 17] each step is 1 wide.
    const bins = colorBins("chart-seq", [10, 17]);
    expect([10, 10.99, 11, 13.5, 16.99, 17].map(bins)).toEqual([1, 1, 2, 4, 7, 7]);
  });

  it("paints a flat or all-zero series step 4", () => {
    expect(colorBins("chart-seq", [2, 2, 2])(2)).toBe(4);
    expect(colorBins("chart-diverging", [0, 0])(0)).toBe(4);
  });

  it("mirrors x and −x on the diverging scale", () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 30 }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        (values, probe) => {
          const bins = colorBins("chart-diverging", values);
          expect(bins(probe) + bins(-probe)).toBe(8);
        }
      ),
      { seed: 20261018, numRuns: 500 }
    );
  });
});

describe("section 11 colour-key escape", () => {
  // Oracle: ten keys and their property fragments, escaped by hand from the rule's text.
  it.each([
    ["price", "price"],
    ["Fast beløp", "Fast_20_bel_f8_p"],
    ["net_rent", "net_5f_rent"],
    ["NO1", "NO1"],
    ["spot-price", "spot-price"],
    ["Strøm", "Str_f8_m"],
    ["a.b", "a_2e_b"],
    ["kWh/h", "kWh_2f_h"],
    ["😀", "_1f600_"],
    ["", ""],
    // The edges of the kept ranges, each written by hand from its code point.
    ["/09:@AZ[`az{-,", "_2f_09_3a__40_AZ_5b__60_az_7b_-_2c_"],
  ])("escapes %j as %j", (key, expected) => {
    expect(escapeColorKey(key)).toBe(expected);
  });

  it("reads the per-key property with the config role as the fallback", () => {
    expect(seriesPaint("Fast beløp", "chart-2")).toBe("var(--chart-color-Fast_20_bel_f8_p, var(--chart-2))");
  });

  it("is one-to-one and emits only [A-Za-z0-9_-]", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme" }), fc.string({ unit: "grapheme" }), (a, b) => {
        expect(escapeColorKey(a)).toMatch(/^[A-Za-z0-9_-]*$/u);
        if (a !== b) expect(escapeColorKey(a)).not.toBe(escapeColorKey(b));
      }),
      { seed: 20261018, numRuns: 1000 }
    );
  });
});
