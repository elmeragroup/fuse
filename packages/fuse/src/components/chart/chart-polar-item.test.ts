// Unit under test: pieModel in production, over far more broken categories than a call's argument
// list holds. Oracle: a model that draws, one warning record per category with a broken value, in
// row order, as main's per-record append gave.
import { afterEach, describe, expect, it, vi } from "vitest";

import { pieModel } from "./chart-polar-item";
import { sweepOf } from "./layout/polar-angle";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pieModel", () => {
  it("builds a model with one warning per broken category past 150,000 categories", () => {
    vi.stubEnv("NODE_ENV", "production");
    const count = 150_000;
    const rows = Array.from({ length: count }, (_, index) => ({ name: `c${String(index)}`, v: Number.NaN }));
    const model = pieModel({
      rows,
      config: { c0: { label: "C0", color: "chart-1" } },
      nameKey: "name",
      valueKey: "v",
      qualityKey: undefined,
      valueFormat: undefined,
      sweep: sweepOf(0, 360),
      locale: "nb-NO",
      name: "Kake",
      part: "PieChart.Root",
      maxSlices: 6,
      innerRadius: 0,
      padAngle: 0,
      max: undefined,
      otherLabel: undefined,
    });
    const broken = model.issues.filter((issue) => issue.rule === "non-finite-value");
    expect(broken).toHaveLength(count);
    expect([broken[0]?.subject, broken.at(-1)?.subject]).toEqual(["c0", `c${String(count - 1)}`]);
  });
});
