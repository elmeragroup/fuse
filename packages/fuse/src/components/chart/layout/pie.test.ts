// The pie's layout. Unit under test: foldPie, pieAngles, floorSlices, sliceAt and gaugeFill.
// Oracles: d3-shape 3.2.0's own pie tests, frozen in fixtures/d3/d3-shape/pie.json by
// .scratch/polar-charts/tools/trim_polar_cases.py, replayed through a facade that sorts as d3 does
// and turns radians into Fuse's degrees; CONTRACT section 8.2's degenerate rows and section 8.4's
// fold fixtures, written by hand; D24's rim floor, one device pixel of rim between a slice's seams;
// and a brute-force raster pick over wedge polygons, which shares no code with the arithmetic pick.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { runD3Cases } from "./fixtures/d3-cases";
import { pie } from "./fixtures/d3-polar-facade";
import pieCases from "./fixtures/d3/d3-shape/pie.json" with { type: "json" };
import { floorSlices, foldPie, gaugeFill, OTHER_KEY, pieAngles, sliceAt } from "./pie";
import type { PieRow, SliceAngles } from "./pie";
import { pointerAngle, sweepOf } from "./polar-angle";
import { roundShares } from "./shares";

const FULL = sweepOf(0, 360);

describe("d3-shape's own pie tests", () => {
  const outcomes = runD3Cases(pieCases, { pie }, { tolerance: 1e-12 });

  it("lays out every case with a positive value as d3's author wrote it", () => {
    expect(outcomes.filter(({ outcome }) => outcome.kind === "fail")).toEqual([]);
    expect(outcomes.filter(({ outcome }) => outcome.kind === "pass")).toHaveLength(13);
  });

  it("leaves the zero and negative rows to section 8.2, which filters them first", () => {
    const filtered = outcomes.flatMap(({ line, outcome }) =>
      outcome.kind === "unsupported" && outcome.reason.includes("no arc") ? [line] : []
    );
    expect(filtered).toEqual([47, 62, 63, 64, 72, 76, 103]);
    // Every other unrun case reads a getter, a function-valued datum or a non-literal binding.
    for (const { outcome } of outcomes) {
      if (outcome.kind !== "unsupported" || outcome.reason.includes("no arc")) continue;
      expect(outcome.reason).toMatch(/getter|\$function|not a literal/u);
    }
  });
});

describe("section 8.2's degenerate rows, written by hand", () => {
  it("draws only the positive row of [1, 0, −1], as d3 draws it over the filtered list", () => {
    // pie.json line 47 gives the row of 1 the whole turn, 0 to 2π, and each other row no width.
    expect(pieAngles([1, 0, -1], FULL, 0)).toEqual([{ start: 0, end: 360, pad: 0 }, null, null]);
  });

  it("draws nothing when the readings sum to 0", () => {
    expect(pieAngles([0, 0], FULL, 0)).toEqual([null, null]);
  });

  it("gives one slice the whole sweep with no pad", () => {
    expect(pieAngles([5], FULL, 3)).toEqual([{ start: 0, end: 360, pad: 0 }]);
  });

  it("draws [1240, 680, −310] as two arcs over [1240, 680], the production fallback", () => {
    // 1240 / 1920 of a turn is 232.5°.
    const [strom, nettleie, credit] = pieAngles([1240, 680, -310], FULL, 0);
    expect(strom?.start).toBe(0);
    expect(strom?.end).toBeCloseTo(232.5, 9);
    expect(nettleie?.end).toBeCloseTo(360, 9);
    expect(credit).toBeNull();
  });

  it("splits two subnormal readings in halves, where d3's own scale would overflow to Infinity", () => {
    expect(pieAngles([5e-324, 5e-324], FULL, 0)).toEqual([
      { start: 0, end: 180, pad: 0 },
      { start: 180, end: 360, pad: 0 },
    ]);
  });

  it("runs each slice under the next by a negative pad, and stops the last at the sweep's end", () => {
    const slices = pieAngles([1, 1, 1], FULL, -5);
    expect(
      slices.map((slice) => [slice?.start, slice?.end].map((angle) => Number(angle?.toFixed(9))))
    ).toEqual([
      [0, 125],
      [120, 245],
      [240, 360],
    ]);
  });
});

describe("section 8.4's fold, written by hand", () => {
  const rows = (values: readonly (number | null)[], roles: Record<number, PieRow["role"]> = {}): PieRow[] =>
    values.map((value, index) => ({ key: `k${String(index)}`, value, role: roles[index] ?? "own" }));

  it("keeps the 5 largest of 9 rows in data order, and folds the 4 smallest into Other last", () => {
    const items = foldPie(rows([40, 5, 30, 8, 25, 3, 20, 2, 15]), 6);
    expect(items.map(({ key, value }) => [key, value])).toEqual([
      ["k0", 40],
      ["k2", 30],
      ["k4", 25],
      ["k6", 20],
      ["k8", 15],
      [OTHER_KEY, 18],
    ]);
    expect(items.at(-1)?.rows).toEqual([1, 3, 5, 7]);
  });

  it("gives a tie at the cut to the earlier row", () => {
    expect(foldPie(rows([10, 5, 5, 5]), 3).map(({ key }) => key)).toEqual(["k0", "k1", OTHER_KEY]);
  });

  it("folds a chart-other category whenever the fold runs, though it is the second largest", () => {
    const items = foldPie(rows([50, 40, 30, 20, 10, 5, 4], { 1: "other" }), 6);
    expect(items.map(({ key }) => key)).toEqual(["k0", "k2", "k3", "k4", "k5", OTHER_KEY]);
    expect(items.at(-1)?.value).toBe(44);
  });

  it("draws a chart-other category as its own slice when the fold does not run", () => {
    expect(foldPie(rows([50, 40, 30], { 1: "other" }), 6).map(({ key }) => key)).toEqual(["k0", "k1", "k2"]);
  });

  it("folds a row whose category has no config entry, whether or not the fold runs", () => {
    const items = foldPie(rows([50, 40, 30], { 2: "unknown" }), 6);
    expect(items.map(({ key, value }) => [key, value])).toEqual([
      ["k0", 50],
      ["k1", 40],
      [OTHER_KEY, 30],
    ]);
  });

  it("keeps Other's value null when every row it holds is missing", () => {
    expect(foldPie(rows([5, 4, 3, null, null]), 4).at(-1)).toEqual({
      key: OTHER_KEY,
      value: null,
      rows: [3, 4],
    });
  });
});

describe("the pick, written by hand", () => {
  const quarters = pieAngles([1, 1, 1, 1], FULL, 0);

  it("picks the slice that holds 0° at a full pie's exact centre", () => {
    expect(sliceAt(pointerAngle(0, 0), quarters, FULL)).toBe(0);
  });

  it.each([
    [45, 0],
    [135, 1],
    [225, 2],
    [315, 3],
  ])("picks the slice at %i°", (angle, slice) => {
    expect(sliceAt(angle, quarters, FULL)).toBe(slice);
  });

  it("picks nothing at a 90 to 270 sweep's exact centre", () => {
    const sweep = sweepOf(90, 270);
    expect(sliceAt(pointerAngle(0, 0), pieAngles([1, 1], sweep, 0), sweep)).toBeNull();
  });

  it("picks nothing past a gauge's filled part", () => {
    const { sweep } = gaugeFill(sweepOf(-135, 135), 1, 2);
    expect(sliceAt(90, pieAngles([1], sweep, 0), sweep)).toBeNull();
    expect(sliceAt(350, pieAngles([1], sweep, 0), sweep)).toBe(0);
  });
});

describe("gaugeFill, written by hand", () => {
  it("fills 3.9 of 5 kWh as 78 % of a 270° gauge", () => {
    const { sweep, over } = gaugeFill(sweepOf(-135, 135), 3.9, 5);
    expect(sweep.width).toBeCloseTo(210.6, 9);
    expect(sweep.end).toBeCloseTo(75.6, 9);
    expect(over).toBe(false);
  });

  it("fills the whole sweep past the maximum, and never laps", () => {
    const { sweep, over } = gaugeFill(sweepOf(-135, 135), 5.6, 5);
    expect(sweep.width).toBe(270);
    expect(over).toBe(true);
  });
});

/** The rim one device pixel past a seam takes, in degrees, D24's floor stated directly. */
function leastAngle(radius: number, dpr: number, seam: number): number {
  return ((seam + 1 / dpr) / radius) * (180 / Math.PI);
}

describe("D24's rim floor, written by hand", () => {
  it("widens two slivers to a device pixel each and takes the angle from the widest slice", () => {
    const least = leastAngle(100, 1, 0);
    const slices = floorSlices(pieAngles([1000, 1, 1], FULL, 0), FULL, { radius: 100, dpr: 1, seam: 0 });
    const widths = slices.map((slice) => (slice === null ? 0 : slice.end - slice.start));
    expect(widths[1]).toBeCloseTo(least, 9);
    expect(widths[2]).toBeCloseTo(least, 9);
    expect(widths[0]).toBeCloseTo(360 - 2 * least, 9);
  });

  it("borrows from the earlier of two equally wide slices", () => {
    const slices = floorSlices(pieAngles([500, 500, 1], FULL, 0), FULL, { radius: 100, dpr: 1, seam: 0 });
    const widths = slices.map((slice) => (slice === null ? 0 : slice.end - slice.start));
    expect(widths[0]).toBeLessThan(widths[1] ?? 0);
    expect(widths[1]).toBeCloseTo(180 * (500 / 500.5), 9);
  });
});

/** Arbitrary pies: up to 12 readings, some tiny, some zero, in any sweep. */
const pies = fc.record({
  values: fc.array(fc.oneof(fc.double({ min: 0, max: 1000, noNaN: true }), fc.constant(0.001)), {
    minLength: 1,
    maxLength: 12,
  }),
  start: fc.integer({ min: -360, max: 360 }),
  width: fc.integer({ min: 30, max: 360 }),
  clockwise: fc.boolean(),
});

describe("the fast-check properties", () => {
  it("sums every share set of the fold's items to 100 at 0, 1 and 2 digits", () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.double({ min: 0, max: 1e6, noNaN: true }), { nil: null }), {
          minLength: 1,
          maxLength: 20,
        }),
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom(0, 1, 2),
        (values, maxSlices, digits) => {
          const items = foldPie(
            values.map((value, index) => ({ key: String(index), value, role: "own" })),
            maxSlices
          );
          const shares = roundShares(
            items.map(({ value }) => value),
            digits
          );
          if (shares.every((share) => share === null)) return;
          const sum = shares.reduce<number>((total, share) => total + Math.abs(share ?? 0), 0);
          expect(sum).toBeCloseTo(100, 9);
        }
      )
    );
  });

  it("picks what a brute-force raster pick over wedge polygons picks", () => {
    fc.assert(
      fc.property(pies, ({ values, start, width, clockwise }) => {
        const sweep = sweepOf(start, start + (clockwise ? width : -width));
        const slices = pieAngles(values, sweep, 0);
        const wedges = rasterWedges(slices);
        for (let y = -95; y <= 95; y += 10) {
          for (let x = -95; x <= 95; x += 10) {
            const raster = rasterPick(x, y, wedges);
            if (raster === "edge") continue;
            expect(sliceAt(pointerAngle(x, y), slices, sweep)).toBe(raster);
          }
        }
      })
    );
  });

  it("keeps a device pixel of rim on every slice, and the floored slices still fill the sweep", () => {
    fc.assert(
      fc.property(
        pies,
        fc.integer({ min: 40, max: 300 }),
        fc.constantFrom(1, 1.5, 2, 3),
        fc.constantFrom(0, 1, 2),
        ({ values, start, width, clockwise }, radius, dpr, seam) => {
          const sweep = sweepOf(start, start + (clockwise ? width : -width));
          const least = leastAngle(radius, dpr, seam);
          const raw = pieAngles(values, sweep, 0);
          const drawn = raw.filter((slice): slice is SliceAngles => slice !== null);
          fc.pre(drawn.length > 0 && drawn.length * least <= sweep.width);
          const floored = floorSlices(raw, sweep, { radius, dpr, seam }).filter(
            (slice): slice is SliceAngles => slice !== null
          );
          expect(floored).toHaveLength(drawn.length);
          let at = sweep.start;
          for (const slice of floored) {
            expect(slice.start).toBeCloseTo(at, 6);
            if (floored.length > 1)
              expect(Math.abs(slice.end - slice.start)).toBeGreaterThanOrEqual(least - 1e-9);
            at = slice.end;
          }
          expect(at).toBeCloseTo(sweep.end, 6);
        }
      )
    );
  });
});

/** One slice's pick region as a polygon from the centre past the rim, sampled every degree or less. */
type Wedge = {
  readonly index: number;
  readonly points: readonly (readonly [number, number])[];
  readonly from: number;
  readonly to: number;
};

/**
 * Each drawn slice's pick region: from its start to the next drawn slice's start, the last to its
 * own end, as polygons through the centre that reach well past the raster.
 */
function rasterWedges(slices: readonly (SliceAngles | null)[]): Wedge[] {
  const drawn = slices.flatMap((slice, index) => (slice === null ? [] : [{ slice, index }]));
  return drawn.map(({ slice, index }, place) => {
    const from = slice.start;
    const to = drawn[place + 1]?.slice.start ?? slice.end;
    const steps = Math.max(2, Math.ceil(Math.abs(to - from)));
    const points: (readonly [number, number])[] = [[0, 0]];
    for (let step = 0; step <= steps; step += 1) {
      const radians = ((from + ((to - from) * step) / steps) * Math.PI) / 180;
      points.push([1000 * Math.sin(radians), -1000 * Math.cos(radians)]);
    }
    return { index, points, from, to };
  });
}

/** Whether a point lies inside a polygon, by ray casting. */
function inside(x: number, y: number, points: readonly (readonly [number, number])[]): boolean {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi = 0, yi = 0] = points[i] ?? [];
    const [xj = 0, yj = 0] = points[j] ?? [];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The slice a raster point's wedge holds, null for none, or "edge" within a degree of a wedge edge. */
function rasterPick(x: number, y: number, wedges: readonly Wedge[]): number | null | "edge" {
  const degrees = (Math.atan2(x, -y) * 180) / Math.PI;
  for (const { from, to } of wedges) {
    for (const edge of [from, to]) {
      const gap = Math.abs(((((degrees - edge) % 360) + 540) % 360) - 180);
      if (gap < 1) return "edge";
    }
  }
  const hits = wedges.filter(({ points }) => inside(x, y, points));
  return hits.at(-1)?.index ?? null;
}
