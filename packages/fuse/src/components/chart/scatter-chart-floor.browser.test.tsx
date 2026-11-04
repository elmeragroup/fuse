// Every mark a scatter plot draws, against the device pixels, in random charts. Unit under test: the
// whole geometry path from the rows to the SVG attributes, for every SVG mark ScatterChart draws:
// the points, the line, the grid, reference lines and the active dot. SCATTER_FLOOR_MARKS lists them,
// a source contract holds the list to the scatter source, and WALKERS walks each one. Oracle: the
// device pixel grid itself and the linear maps written here. Chromium draws an SVG layer's origin
// on the device pixel nearest its page position, so a coordinate c lands on device pixel
// round(origin × dpr) + c × dpr. A dot an even number of device pixels across must centre on the
// device pixel edge nearest the page position its value maps to, and an odd one half a pixel past
// it, as a box edge there would, and a hairline must start on that edge. The
// domains come from d3-array's own nice rule, 10 ticks for x and 5 for y, over the data's extent.
import { nice } from "d3-array";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { SCATTER_FLOOR_MARKS } from "../../../test/chart/floor-marks";
import type { ScatterFloorMark } from "../../../test/chart/floor-marks";
import { emulatePixelRatio } from "../../../test/page-metrics";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { ScatterChart } from "./scatter-chart-namespace";

const CONFIG = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const satisfies ChartConfig;

/** One random chart. */
type Random = {
  readonly points: readonly (readonly [number, number])[];
  readonly width: number;
  readonly offset: number;
  readonly size: "sm" | "md" | "lg";
};

/** The diameter each size names, in CSS pixels, written here from the Points JSDoc. */
const SIZES = { sm: 5, md: 8, lg: 11 } as const;

/** What a walker reads: the host, the plot's page box, the pixel ratio and the domains. */
type Walk = {
  readonly host: HTMLElement;
  readonly plot: DOMRect;
  readonly dpr: number;
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly chart: Random;
};

/** How far a device position may stray from a whole or half pixel: a path rounds to 3 decimals. */
const ROUNDING = 2e-3;

/** A coordinate's device position from the layer's origin. */
function device(walk: Walk, origin: number, at: number): number {
  return Math.ceil(origin * walk.dpr - 0.5 - 1e-6) + at * walk.dpr;
}

/** Assert a device position lies on a pixel edge, or on a pixel's middle when `half`. */
function onGrid(position: number, half: boolean, what: string): void {
  const fraction = position - Math.floor(position);
  const target = half ? 0.5 : 0;
  const off = Math.min(
    Math.abs(fraction - target),
    Math.abs(fraction - target - 1),
    Math.abs(fraction - target + 1)
  );
  expect(off, `${what} at device ${String(position)}`).toBeLessThan(ROUNDING);
}

/**
 * The device pixel edge nearest a page position, a tie toward the top left, as the browser places
 * a box edge, within a millionth of a pixel of the tie.
 */
function edgeOf(walk: Walk, origin: number, at: number): number {
  return Math.ceil((origin + at) * walk.dpr - 0.5 - 1e-6);
}

/** The unsnapped place of a value on an axis of a given length, y counted from the top. */
function mapped(domain: readonly [number, number], length: number, value: number, flip: boolean): number {
  const share = (value - domain[0]) / (domain[1] - domain[0]);
  return (flip ? 1 - share : share) * length;
}

/** The numbers of a path's data in order. */
function numbersOf(d: string | null): number[] {
  return (d ?? "").match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gu)?.map(Number) ?? [];
}

/**
 * d3-array's nice domain over an extent, aiming for a tick count. A magnitude under 1e-15 counts as
 * 0 in a domain, as value-domain.ts documents, since d3's step search overflows below it.
 */
function domainOf(values: readonly number[], count: number): readonly [number, number] {
  const counted = values.map((value) => (Math.abs(value) < 1e-15 ? 0 : value));
  const [low, high] = nice(Math.min(...counted), Math.max(...counted), count);
  return [low, high];
}

type Walkers = { readonly [M in ScatterFloorMark]: (walk: Walk) => number };

const WALKERS: Walkers = {
  "chart-points-path": (walk) => {
    // DOM audit: the points are aria-hidden plot output.
    const path = walk.host.querySelector('[data-slot="chart-points-path"]');
    const diameter = Number(path?.getAttribute("stroke-width"));
    // A dot's diameter is whole device pixels, the size step's rounded.
    const pixels = Math.round(SIZES[walk.chart.size] * walk.dpr);
    expect(diameter * walk.dpr).toBeCloseTo(Math.max(1, pixels), 6);
    const odd = Math.max(1, pixels) % 2 === 1;
    const values = numbersOf(path?.getAttribute("d") ?? null).filter((_, index) => index % 3 !== 2);
    const sorted = [...walk.chart.points].sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
    expect(values.length / 2).toBe(sorted.length);
    sorted.forEach(([x, y], index) => {
      const cx = values[index * 2] ?? Number.NaN;
      const cy = values[index * 2 + 1] ?? Number.NaN;
      const shift = odd ? 0.5 : 0;
      const atX = edgeOf(walk, walk.plot.left, mapped(walk.x, walk.plot.width, x, false)) + shift;
      const atY = edgeOf(walk, walk.plot.top, mapped(walk.y, walk.plot.height, y, true)) + shift;
      expect(Math.abs(device(walk, walk.plot.left, cx) - atX), "dot x").toBeLessThan(ROUNDING);
      expect(Math.abs(device(walk, walk.plot.top, cy) - atY), "dot y").toBeLessThan(ROUNDING);
    });
    return sorted.length;
  },
  "chart-line": (walk) => {
    // DOM audit: the line is aria-hidden plot output.
    const values = numbersOf(walk.host.querySelector('[data-slot="chart-line"]')?.getAttribute("d") ?? null);
    for (let index = 0; index < values.length; index += 2) {
      onGrid(device(walk, walk.plot.left, values[index] ?? Number.NaN), false, "vertex x");
      onGrid(device(walk, walk.plot.top, values[index + 1] ?? Number.NaN), false, "vertex y");
    }
    return values.length / 2;
  },
  "chart-grid-line": (walk) => {
    // DOM audit: grid lines are aria-hidden plot output.
    const lines = [...walk.host.querySelectorAll('[data-slot="chart-grid-line"]')];
    const hairline = Math.max(1, Math.floor(walk.dpr)) / walk.dpr;
    for (const line of lines) {
      const vertical = line.getAttribute("x1") === line.getAttribute("x2");
      const at = Number(line.getAttribute(vertical ? "x1" : "y1")) - hairline / 2;
      onGrid(device(walk, vertical ? walk.plot.left : walk.plot.top, at), false, "grid edge");
    }
    return lines.length;
  },
  "chart-reference-rule": (walk) => {
    // DOM audit: reference rules are aria-hidden plot output.
    const lines = [...walk.host.querySelectorAll('[data-slot="chart-reference-rule"]')];
    const hairline = Math.max(1, Math.floor(walk.dpr)) / walk.dpr;
    for (const line of lines) {
      const at = Number(line.getAttribute("x1")) - hairline / 2;
      // The line marks x = 0, from the edge nearest the page position 0 maps to.
      const edge = edgeOf(walk, walk.plot.left, mapped(walk.x, walk.plot.width, 0, false));
      expect(Math.abs(device(walk, walk.plot.left, at) - edge), "reference edge").toBeLessThan(ROUNDING);
    }
    return lines.length;
  },
  "chart-dot": (walk) => {
    // DOM audit: the active dot is aria-hidden plot output.
    const dot = walk.host.querySelector('[data-slot="chart-active-dot"][data-value] [data-slot="chart-dot"]');
    if (dot === null) return 0;
    const pixels = Math.max(1, Math.round(SIZES[walk.chart.size] * walk.dpr));
    onGrid(device(walk, walk.plot.left, Number(dot.getAttribute("cx"))), pixels % 2 === 1, "active dot x");
    onGrid(device(walk, walk.plot.top, Number(dot.getAttribute("cy"))), pixels % 2 === 1, "active dot y");
    return 1;
  },
};

describe("the scatter floor", () => {
  it("walks every mark the source draws", () => {
    expect(Object.keys(WALKERS).toSorted()).toEqual([...SCATTER_FLOOR_MARKS].toSorted());
  });

  it("draws every mark on the device pixel grid, where its value maps, at any ratio", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          points: fc.array(
            fc.tuple(
              fc.double({ min: -50, max: 50, noNaN: true, noDefaultInfinity: true }),
              fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true })
            ),
            { minLength: 2, maxLength: 60 }
          ),
          width: fc.integer({ min: 120, max: 480 }),
          offset: fc.double({ min: 0, max: 3, noNaN: true }),
          size: fc.constantFrom("sm", "md", "lg"),
        }),
        fc.constantFrom(1, 1.25, 1.5, 2, 3),
        async (chart, dpr) => {
          // A flat extent takes the flat rule, which the model tests cover, so these charts span.
          const span = (values: readonly number[]) => Math.max(...values) - Math.min(...values);
          fc.pre(span(chart.points.map(([x]) => x)) > 1e-3 && span(chart.points.map(([, y]) => y)) > 1e-3);
          await emulatePixelRatio(dpr);
          const rows = chart.points.map(([t, v]) => ({ t, v, s: "a" }));
          const { host, unmount } = renderThemed(
            <LocaleProvider locale="nb-NO">
              <div style={{ marginLeft: chart.offset, marginTop: chart.offset, width: chart.width }}>
                <ScatterChart.Root
                  data={rows}
                  config={CONFIG}
                  xKey="t"
                  yKey="v"
                  seriesKey="s"
                  data-intro="none"
                  aria-label="Tilfeldig"
                  style={{ "--chart-plot-height": "150px" }}>
                  <ScatterChart.Grid />
                  <ScatterChart.Points dataKey="a" size={chart.size} />
                  <ScatterChart.Line dataKey="a" />
                  <ScatterChart.ReferenceLine x={0} />
                  <ScatterChart.ActiveDot />
                </ScatterChart.Root>
              </div>
            </LocaleProvider>
          );
          try {
            // DOM audit: the plot box is Root's measured element.
            const plotElement = host.querySelector('[data-slot="chart-plot"]');
            await expect.poll(() => host.querySelector('[data-slot="chart-points-path"]')).not.toBeNull();
            // The keyboard activates the walk's first point, which the active dot rings.
            await userEvent.keyboard("{Tab}");
            const plot = plotElement?.getBoundingClientRect() ?? new DOMRect();
            const walk: Walk = {
              host,
              plot,
              dpr,
              x: domainOf(
                chart.points.map(([x]) => x),
                10
              ),
              y: domainOf(
                chart.points.map(([, y]) => y),
                5
              ),
              chart,
            };
            const counts = new Map(SCATTER_FLOOR_MARKS.map((mark) => [mark, WALKERS[mark](walk)] as const));
            expect(counts.get("chart-points-path")).toBe(chart.points.length);
            expect(counts.get("chart-dot")).toBe(1);
          } finally {
            unmount();
          }
        }
      ),
      { numRuns: 30 }
    );
  }, 240_000);
});
