// ScatterChart's cost at 100 000 points, in a production build of Chromium. Unit under test: the
// model, the path builder, the spatial index and the surface, end to end. Oracles: SPEC.md's
// performance plan. A first draw of 100 000 points across two series and a data update of as many
// stay under the ceilings below, each the median measured on the owner's machine times two. A
// nearest-point lookup over 100 000 points takes well under a millisecond, as does a pointer
// move's handler, and a data update redraws each series' one path in place, with no remount. The point
// sets come from a fixed generator, so every run draws the same points.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { buildPointIndex, nearestPoint } from "./layout/point-index";
import { buildScatterModel, pointShares } from "./layout/scatter-model";
import { ScatterChart } from "./scatter-chart-namespace";

/**
 * The ceilings, in milliseconds, from paint to paint: the median of five runs measured on the
 * owner's Apple silicon laptop under a load average near 9, times two, rounded up. The first draw
 * measured 66.6 ms and an update 50.0 ms, both whole 16.7 ms frames. SPEC.md records them.
 */
const FIRST_DRAW_MS = 140;
const UPDATE_MS = 100;
/** A nearest-point lookup's median ceiling, SPEC.md's "well under 1 ms". It measured 0.0024 ms. */
const LOOKUP_MS = 0.1;
/** A pointer move's handler, its pick and its store write, measured at 0.2 ms, times two. */
const MOVE_MS = 0.4;

const COUNT = 100_000;

const CONFIG = {
  now: { label: "Forbruk 2026", color: "chart-1" },
  last: { label: "Forbruk 2025", color: "chart-4" },
} as const satisfies ChartConfig;

type Row = { readonly t: number; readonly kwh: number; readonly s: string };

/** A fixed linear congruential generator, so every run draws the same points. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

/** 100 000 weekly readings against temperature, half per series, along a falling signature. */
function rows(seed: number): Row[] {
  const next = generator(seed);
  return Array.from({ length: COUNT }, (_, index) => {
    const t = -10 + next() * 30;
    return { t, kwh: 150_000 - 5_000 * t + (next() - 0.5) * 40_000, s: index % 2 === 0 ? "now" : "last" };
  });
}

function Big({ data }: { readonly data: readonly Row[] }) {
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ width: 800 }}>
        <ScatterChart.Root
          data={data}
          config={CONFIG}
          xKey="t"
          yKey="kwh"
          seriesKey="s"
          data-intro="none"
          aria-label="Stor"
          style={{ "--chart-plot-height": "400px" }}>
          <ScatterChart.Grid />
          <ScatterChart.XAxis />
          <ScatterChart.YAxis />
          <ScatterChart.Points dataKey="last" size="sm" variant="quiet" />
          <ScatterChart.Points dataKey="now" size="sm" />
          <ScatterChart.ActiveDot />
          <ScatterChart.Tooltip />
        </ScatterChart.Root>
      </div>
    </LocaleProvider>
  );
}

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** The median of a list. */
function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

/** Each series' path, once both draw. */
function paths(host: HTMLElement): Element[] {
  // DOM audit: the points are aria-hidden plot output.
  return [...host.querySelectorAll('[data-slot="chart-points-path"]')];
}

describe("100 000 points", () => {
  it("draw for the first time within the ceiling, and the path is one element per series", async () => {
    const runs: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const data = rows(run + 1);
      await frame();
      const start = performance.now();
      const { host, unmount } = renderThemed(<Big data={data} />);
      // The marks draw in the render right after the commit that measured the plot.
      await expect.poll(() => paths(host).length, { interval: 1 }).toBe(2);
      // The frame after the path lands lays it out and paints it, and the next frame's callback
      // runs once that paint is done.
      await frame();
      await frame();
      runs.push(performance.now() - start);
      expect(paths(host).map((path) => (path.getAttribute("d") ?? "").split("M").length - 1)).toEqual([
        COUNT / 2,
        COUNT / 2,
      ]);
      unmount();
    }
    console.info(`scatter first draw, 100 000 points: ${runs.map((ms) => ms.toFixed(1)).join(", ")} ms`);
    expect(median(runs)).toBeLessThan(FIRST_DRAW_MS);
  });

  it("find the point nearest a pointer in well under a millisecond", () => {
    const model = buildScatterModel({
      rows: rows(7),
      xKey: "t",
      yKey: "kwh",
      seriesKey: "s",
      keys: ["now", "last"],
      xInclude: [],
      yInclude: [],
    });
    const build = performance.now();
    const index = buildPointIndex(pointShares(model));
    const built = performance.now() - build;
    const next = generator(99);
    const batches: number[] = [];
    for (let batch = 0; batch < 20; batch += 1) {
      const start = performance.now();
      for (let move = 0; move < 500; move += 1) {
        nearestPoint(index, { x: next(), y: next(), width: 800, height: 400 }, 24);
      }
      batches.push((performance.now() - start) / 500);
    }
    console.info(
      `scatter index build ${built.toFixed(1)} ms; lookup median ${median(batches).toFixed(4)} ms over 10 000 moves`
    );
    expect(median(batches)).toBeLessThan(LOOKUP_MS);
  });

  it("handle a pointer move within the ceiling", async () => {
    const { host, unmount } = renderThemed(<Big data={rows(3)} />);
    await expect.poll(() => paths(host).length).toBe(2);
    await frame();
    const surface = host.querySelector('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    const moves: number[] = [];
    for (let step = 0; step < 120; step += 1) {
      const start = performance.now();
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "mouse",
          clientX: box.left + (box.width * step) / 120,
          clientY: box.top + box.height / 2,
        })
      );
      moves.push(performance.now() - start);
      await frame();
    }
    console.info(`scatter pointer move handler median ${median(moves).toFixed(3)} ms`);
    // Production ReactDOM's Profiler reports nothing, so scatter-chart-renders.browser.test.tsx
    // counts the commits in a development build.
    expect(median(moves)).toBeLessThan(MOVE_MS);
    unmount();
  });

  it("update within the ceiling, redrawing each series' path in place", async () => {
    const runs: number[] = [];
    const { host, rerender, unmount } = renderThemed(<Big data={rows(11)} />);
    await expect.poll(() => paths(host).length).toBe(2);
    const before = paths(host);
    for (let run = 0; run < 5; run += 1) {
      const data = rows(20 + run);
      const old = paths(host).map((path) => path.getAttribute("d"));
      await frame();
      const start = performance.now();
      rerender(<Big data={data} />);
      await expect.poll(() => paths(host)[0]?.getAttribute("d") !== old[0], { interval: 1 }).toBe(true);
      await frame();
      await frame();
      runs.push(performance.now() - start);
    }
    // The same two path elements draw every update.
    expect(paths(host)).toEqual(before);
    console.info(`scatter data update, 100 000 points: ${runs.map((ms) => ms.toFixed(1)).join(", ")} ms`);
    expect(median(runs)).toBeLessThan(UPDATE_MS);
    unmount();
  });
});
