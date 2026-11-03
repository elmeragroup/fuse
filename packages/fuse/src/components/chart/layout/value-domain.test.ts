import { nice, tickIncrement, ticks } from "d3-array";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { runD3Cases } from "./fixtures/d3-cases";
import niceCases from "./fixtures/d3/d3-array/nice.json" with { type: "json" };
import tickIncrementCases from "./fixtures/d3/d3-array/tickIncrement.json" with { type: "json" };
import tickCases from "./fixtures/d3/d3-array/ticks.json" with { type: "json" };
import domains from "./fixtures/value-domains.json" with { type: "json" };
import { valueDomain } from "./value-domain";

describe("the pinned d3-array release", () => {
  // Unit under test: the d3-array 3.2.4 functions the value axis calls. Oracle: d3-array's own
  // test assertions, frozen in the charts ground truth. A pin bump that changed them fails here.
  it.each([
    ["ticks", tickCases],
    ["tickIncrement", tickIncrementCases],
    ["nice", niceCases],
  ] as const)("passes every literal %s case", (_, file) => {
    const outcomes = runD3Cases(file, { ticks, tickIncrement, nice });
    expect(outcomes.filter(({ outcome }) => outcome.kind === "fail")).toEqual([]);
    expect(outcomes.filter(({ outcome }) => outcome.kind === "pass").length).toBeGreaterThan(20);
  });
});

describe("S04's golden price ranges", () => {
  // SCENARIOS.md S04: 0.96567 to 5.23563 SEK on the SE4 day and up to 4.10917 NOK on the NO3 day.
  // Each case is written by hand from the 1-2-5 rule for 5 ticks: a fifth of the span picks the
  // step 1, 2, 5 or 10 times a power of ten, by its leading digit against √2, √10 and √50, and the
  // domain widens outward to whole steps. d3-array's own ticks of the domain cross-check each one.
  it.each([
    // 5.23563 / 5 = 1.047, under √2, so the step is 1 and the top rounds up to 6.
    ["SEK under the zero baseline", [0.96567, 5.23563], "zero", [], [0, 6], [0, 1, 2, 3, 4, 5, 6]],
    // 4.26996 / 5 = 0.854, 8.54 tenths, over √50, so the step is 10 tenths, 1, from 0 to 6.
    ["SEK under the none baseline", [0.96567, 5.23563], "none", [], [0, 6], [0, 1, 2, 3, 4, 5, 6]],
    // 4.10917 / 5 = 0.822, 8.22 tenths, over √50, so the step is 1 and the top rounds up to 5.
    ["NOK under the zero baseline", [0.0, 4.10917], "zero", [], [0, 5], [0, 1, 2, 3, 4, 5]],
    // The price-spike demo's quarters reach −0.155 and 3.665 and its cap of 4 through yInclude:
    // 4.155 / 5 = 0.831, so the step is 1, from −1 to 4, and only the cap reaches the top.
    ["the demo's quarters under the cap of 4", [-0.155, 3.665], "zero", [4], [-1, 4], [-1, 0, 1, 2, 3, 4]],
    // A cap of 8 over the NOK day: 8 / 5 = 1.6, over √2, so the step is 2.
    ["NOK under a cap of 8", [0.0, 4.10917], "zero", [8], [0, 8], [0, 2, 4, 6, 8]],
  ] as const)("ticks %s", (_, values, baseline, include, domain, expected) => {
    const result = valueDomain({ values, baseline, include });
    expect(result.domain).toEqual(domain);
    expect(result.ticks).toEqual(expected);
    expect(ticks(domain[0], domain[1], 5)).toEqual(expected);
  });
});

describe("valueDomain against the tick oracle", () => {
  // Unit under test: valueDomain under the "none" baseline. Oracle: the count-5 cases of
  // ground-truth ticks/cases.json, through a Python port of d3-array's nice and ticks plus
  // section 8.2's widening, written by .scratch/charts-v1/tools/l05-oracles/value_domain_oracle.py.
  it.each(domains.cases.map((row) => [row.id, row] as const))("%s", (_, row) => {
    const result = valueDomain({ values: row.extent, baseline: "none" });
    expect(result.domain).toEqual(row.domain);
    expect(result.ticks).toEqual(row.ticks);
  });
});

describe("section 8.2 degenerate input, written by hand", () => {
  it("gives an all-zero series [0, 1] with the single tick 0", () => {
    expect(valueDomain({ values: [0, 0, 0], baseline: "zero" })).toEqual({ domain: [0, 1], ticks: [0] });
  });

  it("joins a flat non-zero series with 0 under the zero baseline", () => {
    expect(valueDomain({ values: [0.4, 0.4], baseline: "zero" })).toEqual({
      domain: [0, 0.4],
      ticks: [0, 0.1, 0.2, 0.3, 0.4],
    });
  });

  it("widens a flat series by a tenth of its value under the none baseline", () => {
    const { domain, ticks: values } = valueDomain({ values: [0.4], baseline: "none" });
    expect(domain).toEqual([0.36, 0.44]);
    expect(values.map((tick) => Math.round(tick * 100) / 100)).toEqual([0.36, 0.38, 0.4, 0.42, 0.44]);
  });

  it("gives an empty layout [0, 1] with d3's ticks", () => {
    expect(valueDomain({ values: [], baseline: "zero" })).toEqual({
      domain: [0, 1],
      ticks: [0, 0.2, 0.4, 0.6, 0.8, 1],
    });
  });

  it("reaches a yInclude value above the data, such as a price cap", () => {
    expect(valueDomain({ values: [12, 87], baseline: "zero", include: [200] })).toEqual({
      domain: [0, 200],
      ticks: [0, 50, 100, 150, 200],
    });
  });

  it("skips non-finite values", () => {
    expect(
      valueDomain({ values: [Number.NaN, 3, Number.POSITIVE_INFINITY], baseline: "zero" }).domain
    ).toEqual([0, 3]);
  });

  it("writes no −0 bound or tick", () => {
    const result = valueDomain({ values: [-0.3, -0], baseline: "zero" });
    expect([...result.domain, ...result.ticks].some((value) => Object.is(value, -0))).toBe(false);
    expect(result.domain).toEqual([-0.3, 0]);
  });

  it("counts a magnitude below 1e-15 as 0, where d3's step search would overflow", () => {
    expect(valueDomain({ values: [5e-324], baseline: "zero" })).toEqual({ domain: [0, 1], ticks: [0] });
  });

  it("keeps a magnitude of exactly 1e-15", () => {
    expect(valueDomain({ values: [1e-15], baseline: "zero" }).domain).toEqual([0, 1e-15]);
  });

  it("renders 1e15 with ticks of 2e14", () => {
    expect(valueDomain({ values: [0, 1e15], baseline: "zero" }).ticks).toEqual([
      0, 2e14, 4e14, 6e14, 8e14, 1e15,
    ]);
  });
});

describe("the zero rule, as properties", () => {
  // Magnitudes below 1e-15 count as 0 by design, so the properties draw values outside that band.
  const reading = fc
    .double({ min: -1e9, max: 1e9, noNaN: true, noDefaultInfinity: true })
    .filter((value) => value === 0 || Math.abs(value) >= 1e-15);
  const series = fc.array(reading, { minLength: 1, maxLength: 40 });

  it("encloses the extent, 0 under the zero baseline and every include", () => {
    fc.assert(
      fc.property(series, fc.array(reading, { maxLength: 3 }), (values, include) => {
        const { domain } = valueDomain({ values, baseline: "zero", include });
        for (const value of [...values, ...include, 0]) {
          expect(domain[0]).toBeLessThanOrEqual(value);
          expect(domain[1]).toBeGreaterThanOrEqual(value);
        }
      }),
      { seed: 20261018, numRuns: 500 }
    );
  });

  it("puts 0 among the ticks whenever the domain spans 0", () => {
    fc.assert(
      fc.property(series, (values) => {
        const { domain, ticks: values_ } = valueDomain({ values, baseline: "zero" });
        if (domain[0] <= 0 && domain[1] >= 0) expect(values_).toContain(0);
      }),
      { seed: 20261018, numRuns: 500 }
    );
  });

  it("scales its ticks by 10 when the data scales by 10", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -10_000, max: 10_000 }), { minLength: 1, maxLength: 20 }),
        (values) => {
          const once = valueDomain({ values, baseline: "zero" }).ticks;
          const tenfold = valueDomain({ values: values.map((value) => value * 10), baseline: "zero" }).ticks;
          expect(tenfold).toHaveLength(once.length);
          tenfold.forEach((tick, index) => expect(tick).toBeCloseTo((once[index] ?? 0) * 10, 6));
        }
      ),
      { seed: 20261018, numRuns: 300 }
    );
  });
});
