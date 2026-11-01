// Root's entrance as the plot first comes into view, in Chromium with motion on. Oracles, worked
// by hand: four categories reading 1 to 4 on a [0, 4] domain over a 200 px plot draw bars 50, 100,
// 150 and 200 px tall at rest, and 0 px at their base, the entrance's first frame. The Line's wipe
// is the CSS animation chart.css names, held at its start while the chart waits. The test page is
// 896 px tall, and a 2000 px spacer puts the chart below the fold until the test scrolls to it. A
// plot reveals once any of its width and a third of its height show, or half the height it can
// show at most: 448 px of the page, or half a scroll container's own height.
import { Suspense, use, useEffect } from "react";
import type { ReactNode } from "react";

import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { drawnRect } from "../../../test/chart/bar-box";
import { bars } from "../../../test/chart/marks";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { fkasPrivate, renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { Tabs } from "../tabs";
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

/** A Root of the values on a plot of a height, with a Bar on v and a Line on w by default. */
function rootOf(
  values: readonly number[],
  options: { readonly plot?: number; readonly intro?: ChartIntro; readonly children?: ReactNode } = {}
) {
  const { plot = 200, intro, children } = options;
  return (
    <Chart.Root
      data={rowsOf(values)}
      config={CONFIG}
      xKey="name"
      data-intro={intro}
      style={{ "--chart-plot-height": `${String(plot)}px` }}
      aria-label="Inngang i synsfeltet">
      {children ?? (
        <>
          <Chart.Bar dataKey="v" />
          <Chart.Line dataKey="w" />
        </>
      )}
    </Chart.Root>
  );
}

/** A Bar and a Line 400 px wide under a spacer that puts the plot below the fold, or none. */
function chart(
  values: readonly number[],
  options: { readonly above?: number; readonly plot?: number; readonly intro?: ChartIntro } = {}
) {
  const { above = 2000, plot, intro } = options;
  return (
    <LocaleProvider locale="nb-NO">
      <div data-testid="above" style={{ height: above }} />
      <div style={{ width: 400 }}>{rootOf(values, { plot, intro })}</div>
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

/** The plot element, which the observer watches. */
function plotOf(host: HTMLElement): HTMLElement {
  // DOM audit: the plot element is aria-hidden, and only its slot names it.
  const plot = host.querySelector<HTMLElement>('[data-slot="chart-plot"]');
  if (plot === null) throw new Error("no plot");
  return plot;
}

/** How much of the plot's height shows inside a clipping box, the page's viewport by default. */
function visibleHeight(plot: Element, clip: DOMRect = new DOMRect(0, 0, innerWidth, innerHeight)): number {
  const box = plot.getBoundingClientRect();
  return Math.max(0, Math.min(box.bottom, clip.bottom) - Math.max(box.top, clip.top));
}

/**
 * Scroll by a step at a time, with a few frames after each, until the entrance plays or the
 * scroll stops moving, and return the visible height and the entrance state after every step.
 */
async function scrollUntilPlayed(
  host: HTMLElement,
  scroll: () => boolean,
  visible: () => number
): Promise<(readonly [height: number, entrance: string | null])[]> {
  const steps: (readonly [number, string | null])[] = [];
  for (let count = 0; count < 400; count += 1) {
    const moved = scroll();
    await frames(4);
    steps.push([visible(), root(host).getAttribute("data-entrance")]);
    if (!moved || root(host).getAttribute("data-entrance") === "played") break;
  }
  return steps;
}

/** The visible height at the first step that played, and the heights of the steps that waited. */
function playedAt(steps: readonly (readonly [number, string | null])[]) {
  const played = steps.find(([, entrance]) => entrance === "played");
  return {
    played: played?.[0] ?? Number.NaN,
    waited: steps.filter(([, entrance]) => entrance === "waiting").map(([height]) => height),
  };
}

afterEach(async () => {
  window.scrollTo(0, 0);
  await emulateReducedMotion("no-preference");
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
    await expect.poll(() => wipes(host), { timeout: 3000 }).toEqual([]);
    // The wipe has run, so Root drops the attribute every wipe rule reads.
    expect(root(host).hasAttribute("data-entrance")).toBe(false);
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

/** Scroll the page down by a step, and say whether it moved. */
function pageStep(by: number): () => boolean {
  return () => {
    const before = window.scrollY;
    window.scrollBy(0, by);
    return window.scrollY !== before;
  };
}

describe("the reveal as more of the plot shows", () => {
  it("plays a 32,000 px plot once 448 px of it show, scrolled 100 px at a time", async () => {
    // The plot's largest share of the 896 px page is 0.028, so its visible height decides.
    const { host } = renderThemed(chart([1, 2, 3, 4], { above: 1000, plot: 32_000 }));
    const plot = plotOf(host);
    window.scrollBy(0, plot.getBoundingClientRect().top - innerHeight);
    await frames(4);
    const { played, waited } = playedAt(
      await scrollUntilPlayed(host, pageStep(100), () => visibleHeight(plot))
    );
    expect(Math.max(...waited)).toBeLessThan(448);
    expect(played).toBeGreaterThanOrEqual(448);
    expect(played).toBeLessThan(548);
  });

  it("plays a 1200 px wide plot in a 320 px wide scroller once a third of its 200 px shows", async () => {
    // The plot's largest share is 320 of 1200 px, 0.267, and its 200 px never reach half the page.
    // A third of its height is 66.7 px.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ height: 2000 }} />
        <div style={{ width: 320, overflowX: "auto" }}>
          <div style={{ width: 1200 }}>{rootOf([1, 2, 3, 4])}</div>
        </div>
      </LocaleProvider>
    );
    const plot = plotOf(host);
    window.scrollBy(0, plot.getBoundingClientRect().top - innerHeight);
    await frames(4);
    const { played, waited } = playedAt(
      await scrollUntilPlayed(host, pageStep(25), () => visibleHeight(plot))
    );
    expect(Math.max(...waited)).toBeLessThan(200 / 3);
    expect(played).toBeGreaterThanOrEqual(200 / 3);
    expect(played).toBeLessThan(200 / 3 + 25);
  });

  it("plays a plot at the very end of the page, whose middle never reaches the viewport's", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4], { above: 3000 }));
    const plot = plotOf(host);
    window.scrollTo(0, document.documentElement.scrollHeight);
    const box = plot.getBoundingClientRect();
    expect((box.top + box.bottom) / 2).toBeGreaterThan(innerHeight / 2);
    await playToRest(host, REST);
  });

  it("plays a 2000 px plot in a 300 px tall scroll container once half the container shows", async () => {
    // The container shows 300 px of the plot at most, short of a third of it and of half the
    // page. Half the container's height is 150 px.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div data-testid="scroller" style={{ height: 300, overflowY: "auto" }}>
          <div style={{ height: 1000 }} />
          <div style={{ width: 300 }}>{rootOf([1, 2, 3, 4], { plot: 2000 })}</div>
        </div>
      </LocaleProvider>
    );
    // DOM audit: the scroll container is the fixture's own box, which only its test id names.
    const scroller = host.querySelector<HTMLElement>('[data-testid="scroller"]');
    if (scroller === null) throw new Error("no scroller");
    const plot = plotOf(host);
    scroller.scrollTop += plot.getBoundingClientRect().top - scroller.getBoundingClientRect().bottom;
    await frames(4);
    expect(visibleHeight(plot, scroller.getBoundingClientRect())).toBe(0);
    const step = () => {
      const before = scroller.scrollTop;
      scroller.scrollTop += 25;
      return scroller.scrollTop !== before;
    };
    const { played, waited } = playedAt(
      await scrollUntilPlayed(host, step, () => visibleHeight(plot, scroller.getBoundingClientRect()))
    );
    expect(Math.max(...waited)).toBeLessThan(150);
    expect(played).toBeGreaterThanOrEqual(150);
    expect(played).toBeLessThan(175);
  });
});

/** Wait until the first bar has started to grow, so the entrance runs. */
async function entranceRunning(host: HTMLElement): Promise<void> {
  for (let count = 0; count < 120 && !((heights(host)[0] ?? 0) > 0); count += 1) await frame();
  expect(heights(host)[3]).toBeLessThan(200);
  expect(wipes(host)[0]?.playState).toBe("running");
}

/** Wait until the entrance has played to rest and the wipe has ended. */
async function entranceDone(host: HTMLElement): Promise<void> {
  await playToRest(host, REST);
  await expect.poll(() => wipes(host), { timeout: 3000 }).toEqual([]);
}

describe("turning the entrance off once it started", () => {
  it("draws a running entrance at rest when data-intro turns none, and plays nothing when it turns back", async () => {
    const { host, rerender } = renderThemed(chart([1, 2, 3, 4], { above: 0 }));
    await entranceRunning(host);
    rerender(chart([1, 2, 3, 4], { above: 0, intro: "none" }));
    expect(standing(host, REST)).toBe(true);
    expect(root(host).hasAttribute("data-entrance")).toBe(false);
    expect(wipes(host)).toEqual([]);
    rerender(chart([1, 2, 3, 4], { above: 0 }));
    const writes = countWrites(host);
    await frames(20);
    expect(writes()).toBe(0);
    expect(wipes(host)).toEqual([]);
    expect(root(host).hasAttribute("data-entrance")).toBe(false);
  });

  it("drops the played entrance when data-intro turns none, and plays nothing when it turns back", async () => {
    const { host, rerender } = renderThemed(chart([1, 2, 3, 4], { above: 0 }));
    await entranceDone(host);
    rerender(chart([1, 2, 3, 4], { above: 0, intro: "none" }));
    expect(root(host).hasAttribute("data-entrance")).toBe(false);
    rerender(chart([1, 2, 3, 4], { above: 0 }));
    await frames(20);
    expect(wipes(host)).toEqual([]);
    expect(standing(host, REST)).toBe(true);
  });

  it("draws a running entrance at rest under reduced motion, and replays nothing when motion returns", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4], { above: 0 }));
    await entranceRunning(host);
    await emulateReducedMotion("reduce");
    await expect.poll(() => root(host).hasAttribute("data-entrance")).toBe(false);
    expect(standing(host, REST)).toBe(true);
    await emulateReducedMotion("no-preference");
    await frames(20);
    expect(wipes(host)).toEqual([]);
    expect(standing(host, REST)).toBe(true);
  });

  it("replays no wipe after a reduced-motion round trip once the entrance played", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4], { above: 0 }));
    await entranceDone(host);
    await emulateReducedMotion("reduce");
    await expect.poll(() => root(host).hasAttribute("data-entrance")).toBe(false);
    await emulateReducedMotion("no-preference");
    await frames(20);
    expect(wipes(host)).toEqual([]);
  });
});

/** Calls `onCommit` from a passive effect, once the commit that hydrates it has run. */
function CommitMarker({ onCommit }: { readonly onCommit: (() => void) | undefined }): null {
  useEffect(() => {
    onCommit?.();
  }, [onCommit]);
  return null;
}

/** A Line and Dots on v, which wait on `ready` in the browser and render at once on the server. */
function LateSeries({ ready }: { readonly ready: Promise<void> | null }): ReactNode {
  if (ready !== null) use(ready);
  return (
    <>
      <Chart.Line dataKey="v" />
      <Chart.Dots dataKey="v" />
    </>
  );
}

/** A Line on w that hydrates with the chart, and the late series behind a Suspense boundary. */
function LateFixture({
  above,
  ready,
  onLate,
}: {
  readonly above: number;
  readonly ready: Promise<void> | null;
  readonly onLate?: () => void;
}) {
  return (
    <ThemeScope theme={fkasPrivate}>
      <LocaleProvider locale="nb-NO">
        <div style={{ height: above }} />
        <div style={{ width: 400 }}>
          {rootOf([1, 2, 3, 4], {
            children: (
              <>
                <Chart.Line dataKey="w" />
                <Suspense fallback={null}>
                  <LateSeries ready={ready} />
                  <CommitMarker onCommit={onLate} />
                </Suspense>
              </>
            ),
          })}
        </div>
      </LocaleProvider>
    </ThemeScope>
  );
}

/**
 * Hydrate the late fixture's server HTML with the late series held back, and hand back the host,
 * the release that lets the late boundary hydrate, and the cleanup.
 */
function hydrateLate(above: number) {
  const host = document.createElement("div");
  host.innerHTML = renderToString(<LateFixture above={above} ready={null} />);
  document.body.append(host);
  const ready = Promise.withResolvers<void>();
  const late = Promise.withResolvers<void>();
  const hydrated = hydrateRoot(
    host,
    <LateFixture above={above} ready={ready.promise} onLate={late.resolve} />
  );
  return {
    host,
    release: async () => {
      ready.resolve();
      await late.promise;
    },
    unmount: () => {
      hydrated.unmount();
      host.remove();
    },
  };
}

/** A series layer of a slot, by series ordinal: v is 0, w is 1. */
function layer(host: HTMLElement, slot: "chart-line-series" | "chart-dots", series: number): Element {
  // DOM audit: the series layers are aria-hidden plot output, found by slot and series.
  const found = host.querySelector(`[data-slot="${slot}"][data-series="${String(series)}"]`);
  if (found === null) throw new Error(`no ${slot} ${String(series)}`);
  return found;
}

/** A layer's entrance wipe, or undefined when it runs none. */
function wipeOf(element: Element): CSSAnimation | undefined {
  return element
    .getAnimations()
    .find(
      (animation): animation is CSSAnimation =>
        animation instanceof CSSAnimation && animation.animationName.startsWith("chart-wipe")
    );
}

/** Whether a Line layer draws its solid path. */
function drawsLine(element: Element): boolean {
  // DOM audit: the line's solid path is aria-hidden plot output.
  return (
    (element.querySelector('[data-slot="chart-line"][data-part="solid"]')?.getAttribute("d") ?? "") !== ""
  );
}

describe("series that hydrate after the chart", () => {
  it("draw a Line and Dots at rest when their boundary hydrates while the entrance runs", async () => {
    const late = hydrateLate(0);
    try {
      await expect.poll(() => root(late.host).getAttribute("data-entrance")).toBe("played");
      await late.release();
      await expect.poll(() => drawsLine(layer(late.host, "chart-line-series", 0))).toBe(true);
      // The w line hydrated with the chart and still wipes in.
      expect(wipeOf(layer(late.host, "chart-line-series", 1))?.playState).toBe("running");
      for (const slot of ["chart-line-series", "chart-dots"] as const) {
        expect(layer(late.host, slot, 0).getAttribute("data-intro")).toBe("none");
        expect(wipeOf(layer(late.host, slot, 0))).toBeUndefined();
      }
    } finally {
      late.unmount();
    }
  });

  it("draw a Line and Dots at rest when their boundary hydrates after the entrance played", async () => {
    const late = hydrateLate(0);
    try {
      await expect.poll(() => root(late.host).getAttribute("data-entrance")).toBe("played");
      // The w line's 1 s wipe ends.
      await expect
        .poll(() => wipeOf(layer(late.host, "chart-line-series", 1)), { timeout: 3000 })
        .toBeUndefined();
      await late.release();
      await expect.poll(() => drawsLine(layer(late.host, "chart-line-series", 0))).toBe(true);
      for (const slot of ["chart-line-series", "chart-dots"] as const) {
        expect(layer(late.host, slot, 0).getAttribute("data-intro")).toBe("none");
        expect(wipeOf(layer(late.host, slot, 0))).toBeUndefined();
      }
    } finally {
      late.unmount();
    }
  });

  it("join the waiting entrance when their boundary hydrates below the fold, and wipe in with it", async () => {
    const late = hydrateLate(2000);
    try {
      await late.release();
      await expect.poll(() => drawsLine(layer(late.host, "chart-line-series", 0))).toBe(true);
      expect(root(late.host).getAttribute("data-entrance")).toBe("waiting");
      for (const slot of ["chart-line-series", "chart-dots"] as const) {
        expect(layer(late.host, slot, 0).hasAttribute("data-intro")).toBe(false);
        expect(wipeOf(layer(late.host, slot, 0))?.playState).toBe("paused");
      }
      root(late.host).scrollIntoView({ block: "center" });
      await expect.poll(() => wipeOf(layer(late.host, "chart-line-series", 0))?.playState).toBe("running");
    } finally {
      late.unmount();
    }
  });
});

/** A fixture's own box, which only its test id names. */
function byTestId(host: HTMLElement, id: string): HTMLElement {
  // DOM audit: the fixture's wrappers carry no role, so their test ids name them.
  const found = host.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (found === null) throw new Error(`no ${id}`);
  return found;
}

/** Where two boxes overlap, in viewport coordinates. */
function overlap(a: DOMRect, b: DOMRect): DOMRect {
  const top = Math.max(a.top, b.top);
  const left = Math.max(a.left, b.left);
  return new DOMRect(left, top, Math.min(a.right, b.right) - left, Math.min(a.bottom, b.bottom) - top);
}

/** Scroll a container down by a step of its own pixels, and say whether it moved. */
function containerStep(scroller: HTMLElement, by: number): () => boolean {
  return () => {
    const before = scroller.scrollTop;
    scroller.scrollTop += by;
    return scroller.scrollTop !== before;
  };
}

describe("the height a plot can show", () => {
  it.each([
    { outer: 200, offset: 150, shared: 50 },
    { outer: 300, offset: 200, shared: 100 },
  ])(
    "plays a 2000 px plot in a 300 px scroller $offset px down a $outer px clipper once half the $shared px they share shows",
    async ({ outer, offset, shared }) => {
      // The two clippers share only `shared` px of the screen, so the plot shows that much at
      // most, and half of it reveals the plot. The page shows all of both.
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div data-testid="outer" style={{ height: outer, overflow: "hidden" }}>
            <div style={{ height: offset }} />
            <div data-testid="scroller" style={{ height: 300, overflowY: "auto" }}>
              <div style={{ height: 1000 }} />
              <div style={{ width: 300 }}>{rootOf([1, 2, 3, 4], { plot: 2000 })}</div>
            </div>
          </div>
        </LocaleProvider>
      );
      const scroller = byTestId(host, "scroller");
      const clip = () =>
        overlap(byTestId(host, "outer").getBoundingClientRect(), scroller.getBoundingClientRect());
      expect(clip().height).toBe(shared);
      const plot = plotOf(host);
      scroller.scrollTop += plot.getBoundingClientRect().top - clip().bottom;
      await frames(4);
      expect(visibleHeight(plot, clip())).toBe(0);
      const { played, waited } = playedAt(
        await scrollUntilPlayed(host, containerStep(scroller, 5), () => visibleHeight(plot, clip()))
      );
      expect(Math.max(...waited)).toBeLessThan(shared / 2);
      expect(played).toBeGreaterThanOrEqual(shared / 2);
      expect(played).toBeLessThan(shared / 2 + 5);
    }
  );

  it("plays a plot in a scroller scaled to 0.4 once half the 240 px it draws on screen shows", async () => {
    // The scroller lays out 600 px tall and draws 240 px on screen, so the plot shows 240 px of
    // itself at most, and 120 px reveal it. Its 2000 px plot draws 800 px tall, a third of which
    // is more. Each 25 px step of the scroller moves 10 px on screen.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div
          data-testid="scroller"
          style={{ height: 600, overflowY: "auto", transform: "scale(0.4)", transformOrigin: "0 0" }}>
          <div style={{ height: 1500 }} />
          <div style={{ width: 300 }}>{rootOf([1, 2, 3, 4], { plot: 2000 })}</div>
        </div>
      </LocaleProvider>
    );
    const scroller = byTestId(host, "scroller");
    const clip = () => scroller.getBoundingClientRect();
    expect(clip().height).toBeCloseTo(240, 6);
    const plot = plotOf(host);
    expect(plot.getBoundingClientRect().height).toBeCloseTo(800, 6);
    scroller.scrollTop += (plot.getBoundingClientRect().top - clip().bottom) / 0.4;
    await frames(4);
    const { played, waited } = playedAt(
      await scrollUntilPlayed(host, containerStep(scroller, 25), () => visibleHeight(plot, clip()))
    );
    expect(Math.max(...waited)).toBeLessThan(120);
    expect(played).toBeGreaterThanOrEqual(120 - 1e-6);
    expect(played).toBeLessThan(130);
  });
});

/** Count the page's scroll events from now on, in the capture phase, as every scroll reaches it. */
function countScrolls(): () => number {
  let count = 0;
  const listener = () => {
    count += 1;
  };
  addEventListener("scroll", listener, true);
  return () => {
    removeEventListener("scroll", listener, true);
    return count;
  };
}

describe("the reveal with no scroll", () => {
  it("plays a 200 px plot that shows 30 px once the viewport grows to show 100 px of it", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4]));
    const plot = plotOf(host);
    window.scrollBy(0, plot.getBoundingClientRect().top - (innerHeight - 30));
    await frames(6);
    expect(visibleHeight(plot)).toBe(30);
    expect(root(host).getAttribute("data-entrance")).toBe("waiting");
    const scrolls = countScrolls();
    try {
      await page.viewport(414, 966);
      await expect.poll(() => root(host).getAttribute("data-entrance")).toBe("played");
      expect(visibleHeight(plot)).toBe(100);
      expect(scrolls()).toBe(0);
    } finally {
      await page.viewport(414, 896);
    }
  });

  it("plays a 200 px plot that shows 30 px once the content above it collapses by 70 px", async () => {
    const { host } = renderThemed(chart([1, 2, 3, 4]));
    const plot = plotOf(host);
    const above = byTestId(host, "above");
    above.style.height = `${String(2000 - (plot.getBoundingClientRect().top - (innerHeight - 30)))}px`;
    await frames(6);
    expect(window.scrollY).toBe(0);
    expect(visibleHeight(plot)).toBe(30);
    expect(root(host).getAttribute("data-entrance")).toBe("waiting");
    const scrolls = countScrolls();
    above.style.height = `${String(above.getBoundingClientRect().height - 70)}px`;
    await expect.poll(() => root(host).getAttribute("data-entrance")).toBe("played");
    expect(visibleHeight(plot)).toBe(100);
    expect(scrolls()).toBe(0);
  });
});

describe("the reveal's listeners", () => {
  it("leave after the last reveal and the last unmount, and come back for the next waiting chart", async () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    try {
      /** The reveal's own listener: the one function it adds for scroll in the capture phase. */
      const own = () =>
        added.mock.calls.find(([type, , options]) => type === "scroll" && options === true)?.[1];
      /** How often a spy saw the reveal's listener for a type. */
      const count = (spy: typeof added, type: string) =>
        spy.mock.calls.filter(([seen, listener]) => seen === type && listener === own()).length;
      // A chart in view reveals, and its reveal, the last, removes what its watch added.
      const shown = renderThemed(chart([1, 2, 3, 4], { above: 0 }));
      expect(own()).toBeDefined();
      expect([count(added, "scroll"), count(added, "resize")]).toEqual([1, 1]);
      expect([count(removed, "scroll"), count(removed, "resize")]).toEqual([0, 0]);
      await expect.poll(() => root(shown.host).getAttribute("data-entrance")).toBe("played");
      expect([count(removed, "scroll"), count(removed, "resize")]).toEqual([1, 1]);
      shown.unmount();
      // A chart below the fold waits, and unmounting it, the last waiting one, removes them again.
      const hidden = renderThemed(chart([1, 2, 3, 4]));
      await frames(4);
      expect([count(added, "scroll"), count(added, "resize")]).toEqual([2, 2]);
      hidden.unmount();
      expect([count(removed, "scroll"), count(removed, "resize")]).toEqual([2, 2]);
      // The next waiting chart watches anew and plays once it shows.
      const next = renderThemed(chart([1, 2, 3, 4]));
      await frames(4);
      expect([count(added, "scroll"), count(added, "resize")]).toEqual([3, 3]);
      root(next.host).scrollIntoView({ block: "center" });
      await playToRest(next.host, REST);
      expect([count(removed, "scroll"), count(removed, "resize")]).toEqual([3, 3]);
    } finally {
      added.mockRestore();
      removed.mockRestore();
    }
  });
});

/** Every CSS layer a chart can wipe in, an Area, a Line and its Dots on w, over the Bar on v. */
const LAYERS = (
  <>
    <Chart.Bar dataKey="v" />
    <Chart.Area dataKey="w" />
    <Chart.Line dataKey="w" />
    <Chart.Dots dataKey="w" />
  </>
);

/** The chart's Area, Line and Dots layers, which the entrance wipes in. */
function cssLayers(host: HTMLElement): Element[] {
  // DOM audit: the series layers are aria-hidden plot output, found by their slots.
  const found = [
    ...host.querySelectorAll(
      '[data-slot="chart-area-series"], [data-slot="chart-line-series"], [data-slot="chart-dots"]'
    ),
  ];
  expect(found).toHaveLength(3);
  return found;
}

/** The CSS animations any of the chart's Area, Line and Dots layers runs or holds. */
function layerAnimations(host: HTMLElement): string[] {
  return cssLayers(host).flatMap((layer) =>
    layer
      .getAnimations()
      .flatMap((animation) => (animation instanceof CSSAnimation ? [animation.animationName] : []))
  );
}

/**
 * Wait until a chart with every CSS layer has played its entrance to rest: the bars stand, each
 * layer's wipe has run, and Root has dropped the attribute the wipe rules read, which it does on
 * the wipe's end event, dispatched in the frame after the wipe leaves the layer.
 */
async function layersAtRest(host: HTMLElement): Promise<void> {
  await playToRest(host, REST);
  await expect.poll(() => layerAnimations(host), { timeout: 3000 }).toEqual([]);
  await expect.poll(() => root(host).hasAttribute("data-entrance")).toBe(false);
}

/**
 * Over 20 frames, no Area, Line or Dots layer animates, and the bars stand at rest. Each layer
 * then clips as chart.css rests it: an Area and a Line keep a 0.5rem margin across the value
 * axis, 8 px at the 16 px root, and Dots clip nothing.
 */
async function staysAtRest(host: HTMLElement): Promise<void> {
  for (let count = 0; count < 20; count += 1) {
    await frame();
    expect(layerAnimations(host)).toEqual([]);
    expect(standing(host, REST)).toBe(true);
  }
  expect(cssLayers(host).map((layer) => getComputedStyle(layer).clipPath)).toEqual([
    "inset(-8px 0px)",
    "inset(-8px 0px)",
    "none",
  ]);
}

describe("the entrance once it has run", () => {
  it("wipes no layer in again when its keepMounted tab panel is hidden and shown", async () => {
    // A hidden panel takes display none, which cancels CSS animations, so showing it would start
    // any wipe that still matched from its first frame.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Tabs.Root defaultValue="chart">
          <Tabs.List aria-label="Views">
            <Tabs.Trigger value="chart">Chart</Tabs.Trigger>
            <Tabs.Trigger value="other">Other</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="chart" keepMounted>
            <div style={{ width: 400 }}>{rootOf([1, 2, 3, 4], { children: LAYERS })}</div>
          </Tabs.Content>
          <Tabs.Content value="other" keepMounted>
            Other panel
          </Tabs.Content>
        </Tabs.Root>
      </LocaleProvider>
    );
    await layersAtRest(host);
    await userEvent.click(page.getByRole("tab", { name: "Other" }));
    await frames(5);
    expect(root(host).getClientRects()).toHaveLength(0);
    await userEvent.click(page.getByRole("tab", { name: "Chart" }));
    await frames(2);
    expect(root(host).getClientRects()).toHaveLength(1);
    await staysAtRest(host);
  });

  it.each(["right", "center", "edges"] as const)(
    "wipes no layer in when the origin turns %s after the entrance",
    async (origin) => {
      // A new origin names another wipe animation, which would start from its first frame.
      const layered = (intro?: ChartIntro) => (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 400 }}>{rootOf([1, 2, 3, 4], { intro, children: LAYERS })}</div>
        </LocaleProvider>
      );
      const { host, rerender } = renderThemed(layered());
      await layersAtRest(host);
      rerender(layered(origin));
      expect(root(host).getAttribute("data-intro")).toBe(origin);
      await staysAtRest(host);
    }
  );
});

describe("the entrance in a collapsed container", () => {
  it("waits while the plot only touches the clip edge of a container 0 px tall, then plays once it opens", async () => {
    // The observer counts a plot on the clip edge as meeting the container, with no height shown.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div data-testid="collapsed" style={{ height: 0, overflow: "hidden" }}>
          <div data-testid="lift" style={{ width: 400 }}>
            {rootOf([1, 2, 3, 4])}
          </div>
        </div>
      </LocaleProvider>
    );
    const collapsed = byTestId(host, "collapsed");
    const plot = plotOf(host);
    // Lift the chart so its plot's top lies on the container's top edge, before the observer
    // reads it.
    byTestId(host, "lift").style.marginTop =
      `${String(collapsed.getBoundingClientRect().top - plot.getBoundingClientRect().top)}px`;
    expect(collapsed.getBoundingClientRect().height).toBe(0);
    expect(plot.getBoundingClientRect().top).toBe(collapsed.getBoundingClientRect().top);
    await frames(10);
    expect(root(host).getAttribute("data-entrance")).toBe("waiting");
    expect(heights(host)).toEqual([0, 0, 0, 0]);
    collapsed.style.height = "auto";
    await playToRest(host, REST);
  });
});
