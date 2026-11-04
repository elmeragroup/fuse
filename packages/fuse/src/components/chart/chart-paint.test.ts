// The shared series paint (X5). Unit under test: seriesPaintOf, which every mark and swatch reads.
// Oracles: CONTRACT section 11's override form `var(--chart-color-<key>, var(--<role>))`, written
// out by hand, section 8.9's chart-seq bins over a 0 to 70 extent, 7 equal steps of 10, and
// ChartThresholdColor's documented rule: a value above the threshold paints `above`, a value at it
// or below paints `below`.
import { describe, expect, it } from "vitest";

import {
  colourFamilyError,
  nonFiniteThresholds,
  seriesPaintOf,
  stackedScaleError,
  valuePaint,
} from "./chart-paint";
import type { ChartThresholdColor } from "./chart-types";
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

const POSITIVE = "var(--chart-color-v, var(--chart-sentiment-positive))";
const NEGATIVE = "var(--chart-color-v, var(--chart-sentiment-negative))";

function threshold(at: number): ChartThresholdColor {
  return {
    threshold: at,
    below: { color: "chart-sentiment-positive", label: "Under" },
    above: { color: "chart-sentiment-negative", label: "Over" },
  };
}

describe("a threshold colour", () => {
  it("is a two-step paint: below then above, split at the threshold", () => {
    const paint = seriesPaintOf("v", threshold(50), series([20, 50, 80]));
    expect(paint.ramp).toEqual([POSITIVE, NEGATIVE]);
    expect(paint.edges).toEqual([50]);
    expect(paint.stops).toBeUndefined();
    expect(paint.base).toBe(POSITIVE);
  });

  it("paints a value above the threshold above, and a value at it or below it below", () => {
    const paint = seriesPaintOf("v", threshold(50), series([20, 50, 80]));
    expect(valuePaint(paint, 80)).toBe(NEGATIVE);
    expect(valuePaint(paint, 50.001)).toBe(NEGATIVE);
    expect(valuePaint(paint, 50)).toBe(POSITIVE);
    expect(valuePaint(paint, 20)).toBe(POSITIVE);
    expect(valuePaint(paint, -1000)).toBe(POSITIVE);
  });

  it("paints every value one side when the threshold lies outside the series' extent", () => {
    const high = seriesPaintOf("v", threshold(100), series([10, 20, 30]));
    expect([10, 20, 30].map((value) => valuePaint(high, value))).toEqual([POSITIVE, POSITIVE, POSITIVE]);
    // The edge stays where the threshold is, so the gradient clamps it to the frame's end.
    expect(high.edges).toEqual([100]);
    const low = seriesPaintOf("v", threshold(-5), series([10, 20, 30]));
    expect([10, 20, 30].map((value) => valuePaint(low, value))).toEqual([NEGATIVE, NEGATIVE, NEGATIVE]);
  });

  it("splits a flat series by where it sits, where a scale would paint its middle step", () => {
    const flat = series([5, 5, 5]);
    expect(valuePaint(seriesPaintOf("v", threshold(5), flat), 5)).toBe(POSITIVE);
    expect(valuePaint(seriesPaintOf("v", threshold(4), flat), 5)).toBe(NEGATIVE);
  });

  it("paints every value below, with no edge, when the threshold is not finite", () => {
    for (const at of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const paint = seriesPaintOf("v", threshold(at), series([-10, 0, 10]));
      expect(paint.edges).toEqual([]);
      expect([-10, 0, 10].map((value) => valuePaint(paint, value))).toEqual([POSITIVE, POSITIVE, POSITIVE]);
    }
  });

  it("shares one paint across labels, and builds another for another threshold or role", () => {
    const model = series([0, 70]);
    const first = seriesPaintOf("v", threshold(35), model);
    expect(
      seriesPaintOf(
        "v",
        { ...threshold(35), above: { color: "chart-sentiment-negative", label: "Høy" } },
        model
      )
    ).toBe(first);
    expect(seriesPaintOf("v", threshold(36), model)).not.toBe(first);
    expect(
      seriesPaintOf("v", { ...threshold(35), above: { color: "chart-other", label: "Over" } }, model)
    ).not.toBe(first);
  });

  it("names every series whose threshold is not finite, in config order", () => {
    expect(nonFiniteThresholds({ a: { label: "A", color: threshold(1) } })).toEqual([]);
    expect(
      nonFiniteThresholds({
        a: { label: "A", color: "chart-1" },
        b: { label: "B", color: threshold(Number.NaN) },
        c: { label: "C", color: threshold(2) },
        d: { label: "D", color: threshold(Number.POSITIVE_INFINITY) },
      })
    ).toEqual(["b", "d"]);
  });

  it("counts both sides' roles in a layout's colour family", () => {
    const config = {
      price: { label: "Price", color: threshold(1) },
      usage: { label: "Usage", color: "chart-1" },
    } as const;
    expect(colourFamilyError("Chart.Root", config, ["price"])).toBeNull();
    expect(colourFamilyError("Chart.Root", config, ["price", "usage"])?.rule).toBe(
      "mixed-sentiment-categorical"
    );
  });

  it("cannot paint a stacked or expanded path, as a scale cannot", () => {
    expect(stackedScaleError("Chart.Line", threshold(1), false, "diverging")).toBeNull();
    expect(stackedScaleError("Chart.Line", threshold(1), true, "diverging")?.rule).toBe(
      "scale-colour-on-stack"
    );
    expect(stackedScaleError("Chart.Area", threshold(1), false, "expand")?.message).toBe(
      'Chart.Area paints a threshold colour on stackOffset="expand", where the path draws at stacked values the threshold doesn\'t follow. Give the series a role, or draw it with Chart.Bar.'
    );
  });
});
