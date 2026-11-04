// ScatterChart's cost at 100 000 points, in a production build of Chromium. Unit under test: the
// model, the path builder, the spatial index and the surface, end to end. Oracles: the performance
// plan's rules. A first draw of 100 000 points across two series and a data update of as many stay
// under the ceilings below. A nearest-point lookup over 100 000 points takes well under a
// millisecond, as does a pointer move's handler, which hit-tests points it is known to land on,
// and a data update redraws each series' one path in place, with no remount. The point sets come
// from a fixed generator, so every run draws the same points.
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { ChartConfig } from "./chart-types";
import "./chart.css";
import { buildPointIndex, nearestPoint } from "./layout/point-index";
import { buildScatterModel, pointShares } from "./layout/scatter-model";
import { ScatterChart } from "./scatter-chart-namespace";

/**
 * The ceilings, in milliseconds, from paint to paint, so each covers the main thread's work and
 * the paint. The clock starts in a frame's callback and stops in one, so every run measures whole
 * 16.7 ms frames. The gate runs on CI's ubuntu-latest runner, which runs JavaScript about 2.2
 * times slower than an Apple silicon laptop and rasterises 100 000 round caps in software, so each
 * ceiling is CI's median of five runs times 1.5, rounded up to a whole frame.
 *
 * Measured on c47d4278, as five runs and their median:
 *
 * - First draw on CI: 154.8, 116.5, 139.3, 132.2 and 100.0 ms, median 132.2 ms, so 12 frames.
 * - Update on CI: 123.7, 116.8, 116.6, 116.6 and 116.6 ms, median 116.6 ms, so 11 frames.
 * - On the laptop under a load average near 9: a first draw of 66.6 ms and an update of 50.0 ms.
 */
const FIRST_DRAW_MS = 200;
const UPDATE_MS = 184;
/**
 * A nearest-point lookup's median ceiling, well under the plan's 1 ms. It measured 0.0024 ms on
 * the laptop and 0.0052 ms on CI.
 */
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
      await nextFrames();
      const start = performance.now();
      const { host, unmount } = renderThemed(<Big data={data} />);
      // The marks draw in the render right after the commit that measured the plot.
      await expect.poll(() => paths(host).length, { interval: 1 }).toBe(2);
      // The frame after the path lands lays it out and paints it, and the next frame's callback
      // runs once that paint is done.
      await nextFrames(2);
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
    await nextFrames();
    const surface = host.querySelector('[role="listbox"]');
    if (surface === null) throw new Error("The plot's surface did not mount.");
    const box = surface.getBoundingClientRect();
    /** Move the pointer to a share of the plot, x from the left and y from the top. */
    const moveTo = (x: number, y: number): void => {
      surface.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "mouse",
          clientX: box.left + box.width * x,
          clientY: box.top + box.height * y,
        })
      );
    };
    // DOM audit: Root's active state is the attribute its CSS reads.
    const active = () => host.querySelector('[data-slot="chart"]')?.hasAttribute("data-active") === true;
    // The positive control, worked by hand: t spans −10 to 20 and kWh about 30 000 to 220 000, which
    // nice to [−10, 20] and [0, 250 000]. The fixture's first row, t = −10 + 30 r and kWh = 150 000 −
    // 5 000 t + 40 000 (s − 0.5) for its generator's first two draws r and s, lies at x share
    // (t + 10) / 30 and y share 1 − kWh / 250 000, where a move must find a point. The top right
    // corner, t = 20 at 250 000 kWh, lies 180 000 kWh above the band there, where a move finds none.
    const draw = generator(3);
    const t = -10 + draw() * 30;
    const kwh = 150_000 - 5_000 * t + (draw() - 0.5) * 40_000;
    moveTo((t + 10) / 30, 1 - kwh / 250_000);
    await nextFrames();
    expect(active()).toBe(true);
    moveTo(0.999, 0.001);
    await nextFrames();
    expect(active()).toBe(false);
    const moves: number[] = [];
    let hits = 0;
    for (let step = 0; step < 120; step += 1) {
      const start = performance.now();
      moveTo(step / 120, 0.5);
      moves.push(performance.now() - start);
      await nextFrames();
      if (active()) hits += 1;
    }
    // The sweep at half height crosses the band, so some of its moves found points.
    expect(hits).toBeGreaterThan(0);
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
      await nextFrames();
      const start = performance.now();
      rerender(<Big data={data} />);
      await expect.poll(() => paths(host)[0]?.getAttribute("d") !== old[0], { interval: 1 }).toBe(true);
      await nextFrames(2);
      runs.push(performance.now() - start);
    }
    // The same two path elements draw every update.
    expect(paths(host)).toEqual(before);
    console.info(`scatter data update, 100 000 points: ${runs.map((ms) => ms.toFixed(1)).join(", ")} ms`);
    expect(median(runs)).toBeLessThan(UPDATE_MS);
    unmount();
  });
});
