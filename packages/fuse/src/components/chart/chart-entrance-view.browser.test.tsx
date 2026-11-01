// Root's entrance as the plot first comes into view, in Chromium with motion on. Oracles, worked
// by hand: four categories reading 1 to 4 on a [0, 4] domain over a 200 px plot draw bars 50, 100,
// 150 and 200 px tall at rest, and 0 px at their base, the entrance's first frame. The Line's wipe
// is the CSS animation chart.css names, held at its start while the chart waits. The test page is
// 896 px tall, and a 2000 px spacer puts the chart below the fold until the test scrolls to it.
import { afterEach, describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { drawnRect } from "../../../test/chart/bar-box";
import { bars } from "../../../test/chart/marks";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartIntro } from "./chart-types";
import "./chart.css";

const CONFIG = {
  v: { label: "V", color: "chart-1" },
  w: { label: "W", color: "chart-2" },
} as const satisfies ChartConfig;

/** The bar heights at rest of the readings 1 to 4. */
const REST = [50, 100, 150, 200];

/** One row array per value array, so a render that changes nothing hands Root the same data. */
const known = new Map<string, readonly { name: string; v: number; w: number }[]>();

function rowsOf(values: readonly number[]) {
  const key = values.join(" ");
  const rows = known.get(key) ?? values.map((v, index) => ({ name: `c${String(index)}`, v, w: 2 }));
  known.set(key, rows);
  return rows;
}

/** A Bar and a Line under a spacer that puts the plot below the fold, or none. */
function chart(
  values: readonly number[],
  options: { readonly above?: number; readonly plot?: number; readonly intro?: ChartIntro } = {}
) {
  const { above = 2000, plot = 200, intro } = options;
  return (
    <LocaleProvider locale="nb-NO">
      <div style={{ height: above }} />
      <div style={{ width: 400 }}>
        <Chart.Root
          data={rowsOf(values)}
          config={CONFIG}
          xKey="name"
          data-intro={intro}
          style={{ "--chart-plot-height": `${String(plot)}px` }}
          aria-label="Inngang i synsfeltet">
          <Chart.Bar dataKey="v" />
          <Chart.Line dataKey="w" />
        </Chart.Root>
      </div>
    </LocaleProvider>
  );
}

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function frames(count: number): Promise<void> {
  for (let index = 0; index < count; index += 1) await frame();
}

function heights(host: HTMLElement): number[] {
  return bars(host).map((bar) => drawnRect(bar).height);
}

/** Whether every bar stands at its height in `expected`, within half a pixel. */
function standing(host: HTMLElement, expected: readonly number[]): boolean {
  const drawn = heights(host);
  return (
    drawn.length === expected.length &&
    drawn.every((height, index) => Math.abs(height - (expected[index] ?? 0)) <= 0.5)
  );
}

function root(host: HTMLElement): HTMLElement {
  // DOM audit: Root's figure is the chart's named landmark, found by its slot like every part.
  const figure = host.querySelector<HTMLElement>('[data-slot="chart"]');
  if (figure === null) throw new Error("no chart");
  return figure;
}

/** The Line wrapper's running or held CSS animations, the entrance wipe among them. */
function wipes(host: HTMLElement): CSSAnimation[] {
  // DOM audit: the line series wrapper is aria-hidden plot output.
  const line = host.querySelector('[data-slot="chart-line-series"]');
  return (line?.getAnimations() ?? []).filter((animation) => animation instanceof CSSAnimation);
}

/**
 * Count the attribute writes inside the marks' layers, as the motion loop writes every frame of a
 * tween, from now on.
 */
function countWrites(host: HTMLElement): () => number {
  let count = 0;
  const observer = new MutationObserver((records) => {
    count += records.length;
  });
  // DOM audit: the bar and line layers are aria-hidden plot output.
  for (const layer of host.querySelectorAll(
    '[data-slot="chart-bar-series"], [data-slot="chart-line-series"]'
  )) {
    observer.observe(layer, { attributes: true, subtree: true });
  }
  return () => {
    const total = count + observer.takeRecords().length;
    observer.disconnect();
    return total;
  };
}

/**
 * Follow the first bar frame by frame until every bar stands at its rest, and return the first
 * bar's heights on the way.
 */
async function playToRest(host: HTMLElement, rest: readonly number[]): Promise<number[]> {
  const seen: number[] = [];
  for (let count = 0; count < 300 && !standing(host, rest); count += 1) {
    await frame();
    seen.push(heights(host)[0] ?? Number.NaN);
  }
  expect(standing(host, rest)).toBe(true);
  return seen;
}

afterEach(() => {
  window.scrollTo(0, 0);
});

describe("the entrance in view", () => {
  it("waits at its first frame below the fold with no frame of motion, then plays to rest once it shows", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4]));
    // The observer reports the plot out of view within a few frames.
    await frames(10);
    expect(root(host).getAttribute("data-entrance")).toBe("waiting");
    expect(heights(host)).toEqual([0, 0, 0, 0]);
    const [wipe] = wipes(host);
    expect(wipe?.animationName).toBe("chart-wipe-left");
    expect(wipe?.playState).toBe("paused");
    expect(wipe?.currentTime).toBe(0);
    const writes = countWrites(host);
    await frames(20);
    expect(writes()).toBe(0);
    root(host).scrollIntoView({ block: "center" });
    const first = await playToRest(host, REST);
    // The first bar grew through the frames between its base and its rest.
    expect(first.some((height) => height > 0 && height < 50)).toBe(true);
    expect(root(host).getAttribute("data-entrance")).toBe("played");
    await expect.poll(() => wipes(host)).toEqual([]);
  });

  it("never plays again after the plot scrolls away and back", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4]));
    await frames(10);
    root(host).scrollIntoView({ block: "center" });
    await playToRest(host, REST);
    await expect.poll(() => wipes(host)).toEqual([]);
    window.scrollTo(0, 0);
    await frames(10);
    const writes = countWrites(host);
    root(host).scrollIntoView({ block: "center" });
    for (let count = 0; count < 30; count += 1) {
      await frame();
      expect(standing(host, REST)).toBe(true);
      expect(wipes(host)).toEqual([]);
    }
    expect(writes()).toBe(0);
  });

  it("plays an update that arrives while it waits with the new data, the bar it adds included", async () => {
    const { host, rerender } = renderThemed(chart([1, 2, 3, 4]));
    await frames(10);
    rerender(chart([4, 3, 2, 1, 2]));
    // Five bands of 80 px. The added fifth bar waits at its base with the rest and fades in no way.
    expect(heights(host)).toEqual([0, 0, 0, 0, 0]);
    expect(bars(host)[4]?.hasAttribute("data-intro")).toBe(false);
    const writes = countWrites(host);
    await frames(10);
    expect(writes()).toBe(0);
    expect(heights(host)).toEqual([0, 0, 0, 0, 0]);
    root(host).scrollIntoView({ block: "center" });
    const first = await playToRest(host, [200, 150, 100, 50, 100]);
    expect(first.some((height) => height > 0 && height < 200)).toBe(true);
  });

  it("plays a plot taller than the viewport once it covers half the viewport's height", async () => {
    // A 2400 px plot shows a third of itself only past 800 px, more than the 896 px page shows
    // beside the axis row. It plays once 520 px of it show, over half of 896, and not at 300 px.
    const tall = [600, 1200, 1800, 2400];
    const { host } = renderThemed(chart([1, 2, 3, 4], { plot: 2400 }));
    // DOM audit: the plot element is aria-hidden, and the observer watches it.
    const plot = host.querySelector('[data-slot="chart-plot"]');
    const reveal = (visible: number) => {
      window.scrollBy(0, (plot?.getBoundingClientRect().top ?? 0) - (window.innerHeight - visible));
    };
    reveal(300);
    await frames(10);
    expect(heights(host)).toEqual([0, 0, 0, 0]);
    reveal(520);
    await playToRest(host, tall);
  });

  it("draws at rest at once with data-intro none, below the fold too", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4], { intro: "none" }));
    expect(standing(host, REST)).toBe(true);
    expect(root(host).hasAttribute("data-entrance")).toBe(false);
    expect(wipes(host)).toEqual([]);
    // Coming into view plays nothing.
    const writes = countWrites(host);
    root(host).scrollIntoView({ block: "center" });
    await frames(10);
    expect(writes()).toBe(0);
    expect(standing(host, REST)).toBe(true);
  });
});

describe("the entrance at print", () => {
  it("draws a waiting chart at rest when a print begins, and plays nothing after", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4]));
    await frames(10);
    window.dispatchEvent(new Event("beforeprint"));
    expect(standing(host, REST)).toBe(true);
    expect(root(host).hasAttribute("data-entrance")).toBe(false);
    expect(wipes(host)).toEqual([]);
    const writes = countWrites(host);
    root(host).scrollIntoView({ block: "center" });
    await frames(20);
    expect(writes()).toBe(0);
    expect(standing(host, REST)).toBe(true);
  });

  it("ends a running entrance at rest when a print begins", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4], { above: 0 }));
    // Wait until the first bar has started to grow, so the entrance runs.
    for (let count = 0; count < 120 && !((heights(host)[0] ?? 0) > 0); count += 1) await frame();
    expect(heights(host)[3]).toBeLessThan(200);
    window.dispatchEvent(new Event("beforeprint"));
    expect(standing(host, REST)).toBe(true);
    expect(wipes(host)).toEqual([]);
  });
});
