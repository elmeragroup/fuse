// The shared series paint (X5). Unit under test: seriesPaintOf, which every mark and swatch reads.
// Oracles: CONTRACT section 11's override form `var(--chart-color-<key>, var(--<role>))`, written
// out by hand, and section 8.9's chart-seq bins over a 0 to 70 extent, 7 equal steps of 10.
import { describe, expect, it } from "vitest";

import { seriesPaintOf, valuePaint } from "./chart-paint";
import type { SeriesModel } from "./layout/cartesian-model";

function series(values: readonly number[]): SeriesModel {
  return {
    key: "v",
    seriesIndex: 0,
    stack: undefined,
    readings: values.map((value) => ({ kind: "reading", value, quality: "measured" })),
    extents: values.map((value) => [0, value]),
    projectedFrom: values.length,
    coarse: undefined,
  };
}

describe("seriesPaintOf", () => {
  it("returns one paint per series model and colour, so a pointer step reuses the bins", () => {
    const model = series([0, 70]);
    const first = seriesPaintOf("v", "chart-seq", model);
    expect(seriesPaintOf("v", "chart-seq", model)).toBe(first);
    expect(seriesPaintOf("v", "chart-diverging", model)).not.toBe(first);
    expect(seriesPaintOf("v", "chart-seq", series([0, 70]))).not.toBe(first);
  });

  it("puts the override first in every stop of a scale, a role list and a role", () => {
    const model = series([0, 70]);
    expect(seriesPaintOf("v", "chart-seq", model).ramp).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((step) => `var(--chart-color-v, var(--chart-seq-${String(step)}))`)
    );
    expect(seriesPaintOf("v", ["chart-1", "chart-3"], model).stops).toEqual([
      "var(--chart-color-v, var(--chart-1))",
      "var(--chart-color-v, var(--chart-3))",
    ]);
    expect(seriesPaintOf("v", "chart-2", model).base).toBe("var(--chart-color-v, var(--chart-2))");
  });

  it("paints a value with its step's stop", () => {
    const paint = seriesPaintOf("v", "chart-seq", series([0, 70]));
    expect(valuePaint(paint, 5)).toBe("var(--chart-color-v, var(--chart-seq-1))");
    expect(valuePaint(paint, 35)).toBe("var(--chart-color-v, var(--chart-seq-4))");
    expect(valuePaint(paint, 70)).toBe("var(--chart-color-v, var(--chart-seq-7))");
    expect(valuePaint(seriesPaintOf("v", "chart-1", series([0, 70])), 35)).toBeUndefined();
  });
});
