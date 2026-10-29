// E11's motion judges in Chromium, Firefox and WebKit, after motion-decision.md "Judges". Each
// expected geometry comes from motion-frames.json, which .scratch/charts-v1/tools/l05-oracles/
// motion_fixture.py writes by hand from the fixture values and cubic-bezier(0, 0.7, 0.5, 1). The
// browser's own client boxes and computed positions are the measured side.
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import { OCTOBER_FIRST_LOAD, OCTOBER_RELOAD, october } from "../../../test/chart/month-switch";
import { MOTION_A, MOTION_B, MOTION_C, MotionChart, oslo } from "../../../test/chart/motion-fixture";
import type { MotionRow } from "../../../test/chart/motion-fixture";
import frames from "../../../test/chart/motion-frames.json" with { type: "json" };
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";

type Box = { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
type Fractions = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly topPx: number;
  readonly bottom: number;
};

const TOLERANCE = 0.5;
let paused: Animation[] = [];

afterEach(() => {
  paused = [];
});

/** The expected box of oracle fractions on a plot. */
function expected(fractions: Fractions, plot: DOMRect): Box {
  return {
    left: fractions.left * plot.width,
    right: fractions.right * plot.width,
    top: fractions.top * plot.height + fractions.topPx,
    bottom: fractions.bottom * plot.height,
  };
}

function expectBox(actual: Box, wanted: Box, label: string): void {
  for (const edge of ["left", "right", "top", "bottom"] as const) {
    expect(Math.abs(actual[edge] - wanted[edge]), `${label} ${edge}`).toBeLessThanOrEqual(TOLERANCE);
  }
}

/** The bars of one series in DOM order, which is x order. */
function seriesBars(host: HTMLElement, seriesIndex: 0 | 1): Element[] {
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [
    ...host.querySelectorAll(
      `[data-slot="chart-bar-series"][data-series="${String(seriesIndex)}"] [data-slot="chart-bar"]`
    ),
  ];
}

function plotOf(host: HTMLElement): DOMRect {
  // DOM audit: the bar series box is the plot box the clip-paths resolve against.
  return host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
}

function rootOf(host: HTMLElement): HTMLElement {
  // DOM audit: Root's figure holds every animation of the chart.
  const root = host.querySelector<HTMLElement>('[data-slot="chart"]');
  if (root === null) throw new Error("no chart");
  return root;
}

/** Finish every running finite animation, such as the entrance. */
function settle(host: HTMLElement): void {
  for (const animation of rootOf(host).getAnimations({ subtree: true })) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)) animation.finish();
  }
}

/** Pause every animation of the chart at one time, as one frame. */
function seek(host: HTMLElement, ms: number): void {
  paused = rootOf(host).getAnimations({ subtree: true });
  for (const animation of paused) {
    animation.pause();
    animation.currentTime = ms;
  }
}

/** Move every running animation of the chart to one time and let it run on, as a real update would. */
function jump(host: HTMLElement, ms: number): void {
  for (const animation of rootOf(host).getAnimations({ subtree: true })) animation.currentTime = ms;
}

async function frame(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/** Wait at least a number of milliseconds by animation frames, which the suites use instead of timers. */
async function waitFrames(ms: number): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < ms) await frame();
}

async function mounted(data: readonly MotionRow[], xRange?: readonly [Date, Date]) {
  const view = renderThemed(<MotionChart data={data} xRange={xRange} />);
  await frame();
  settle(view.host);
  return view;
}

/** Whether an animation runs only on opacity or a colour property. */
function isOpacityOrColour(animation: Animation): boolean {
  const properties =
    "transitionProperty" in animation
      ? [String(animation.transitionProperty)]
      : (animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes() : []).flatMap(
          (keyframe) =>
            Object.keys(keyframe).filter(
              (key) => !["offset", "computedOffset", "easing", "composite"].includes(key)
            )
        );
  return properties.every((property) =>
    ["opacity", "color", "background-color", "backgroundColor", "fill", "stroke"].includes(property)
  );
}

describe("Bar update frames", () => {
  it("shows every bar growing 30 ms after first mount, the positive control", async () => {
    const { host } = renderThemed(<MotionChart data={MOTION_A} />);
    await waitFrames(30);
    for (const seriesIndex of [0, 1] as const) {
      for (const bar of seriesBars(host, seriesIndex)) {
        expect(bar.getAnimations().some((animation) => !isOpacityOrColour(animation))).toBe(true);
      }
    }
  });

  it("moves each surviving bar through the hand-written midpoints of update B", async () => {
    const { host, rerender } = await mounted(MOTION_A);
    rerender(<MotionChart data={MOTION_B} />);
    const plot = plotOf(host);
    for (const ms of ["120", "240", "360", "480"] as const) {
      seek(host, Number(ms));
      for (const entry of frames.updateB) {
        const seriesIndex = entry.series === "p" ? 0 : 1;
        const bar = seriesBars(host, seriesIndex)[entry.day - 2];
        if (bar === undefined) throw new Error(`no bar for ${String(entry.day)}`);
        expectBox(
          barBox(bar, plot),
          expected(entry.at[ms], plot),
          `${entry.series} ${String(entry.day)} at ${ms}`
        );
      }
      // A stacked segment's base follows the segment below it, a seam above it.
      for (const [index, top] of seriesBars(host, 1).entries()) {
        const below = seriesBars(host, 0)[index];
        if (below === undefined) continue;
        expect(Math.abs(barBox(top, plot).bottom - (barBox(below, plot).top - 2))).toBeLessThanOrEqual(
          TOLERANCE
        );
      }
    }
  });

  it("transitions for 480 ms on the motion curve", async () => {
    const { host, rerender } = await mounted(MOTION_A);
    rerender(<MotionChart data={MOTION_B} />);
    const bar = seriesBars(host, 0)[0];
    const transition = bar?.getAnimations().find((animation) => !isOpacityOrColour(animation));
    expect(transition?.effect?.getTiming().duration).toBe(480);
    expect(transition?.effect?.getTiming().easing).toBe("cubic-bezier(0, 0.7, 0.5, 1)");
  });
});

describe("Bar interruption", () => {
  it("continues from the 240 ms geometry when data A returns, and ends on A", async () => {
    const { host, rerender } = await mounted(MOTION_A);
    rerender(<MotionChart data={MOTION_B} />);
    // The second update lands 240 ms into the first, in real time, as a reload would.
    await waitFrames(240);
    // Hold the frame the update lands on, so every engine samples the same geometry before it.
    for (const animation of rootOf(host).getAnimations({ subtree: true })) animation.pause();
    await frame();
    const plot = plotOf(host);
    const before = frames.updateB.map((entry) => {
      const bar = seriesBars(host, entry.series === "p" ? 0 : 1)[entry.day - 2];
      if (bar === undefined) throw new Error("no bar");
      return { entry, box: barBox(bar, plot) };
    });
    // The measured geometry is the oracle's 240 ms frame, give or take the frame it landed on.
    for (const { entry, box } of before) {
      const wanted = expected(entry.at["240"], plot);
      expect(Math.abs(box.left - wanted.left), `${entry.series} ${String(entry.day)}`).toBeLessThanOrEqual(2);
    }
    rerender(<MotionChart data={MOTION_A} />);
    // The first frame after the second update sits where the bar was, with no jump back.
    for (const { entry, box } of before) {
      const bar = seriesBars(host, entry.series === "p" ? 0 : 1)[entry.day - 1];
      if (bar === undefined) throw new Error("no bar");
      expectBox(barBox(bar, plot), box, `${entry.series} ${String(entry.day)}`);
    }
    settle(host);
    for (const box of frames.bars.A) {
      const bar = seriesBars(host, box.series === "p" ? 0 : 1)[box.position];
      if (bar === undefined) throw new Error("no bar");
      expectBox(barBox(bar, plot), expected(box, plot), `A ${box.series} ${String(box.day)}`);
    }
  });
});

describe("Add and leave", () => {
  it("fades 11 October in through opacity only and removes 1 October in the first frame", async () => {
    const { host, rerender } = renderThemed(
      <MotionChart data={MOTION_A}>
        <Chart.Grid />
        <Chart.XAxis />
        <Chart.YAxis />
      </MotionChart>
    );
    await frame();
    settle(host);
    rerender(
      <MotionChart data={MOTION_B}>
        <Chart.Grid />
        <Chart.XAxis />
        <Chart.YAxis />
      </MotionChart>
    );
    const plot = plotOf(host);
    expect(seriesBars(host, 0)).toHaveLength(10);
    expect(seriesBars(host, 1)).toHaveLength(10);
    const added = seriesBars(host, 0)[9];
    expect(added?.getAttribute("data-intro")).toBe("fade");
    const animations = added?.getAnimations() ?? [];
    expect(animations.length).toBeGreaterThan(0);
    expect(animations.every(isOpacityOrColour)).toBe(true);
    seek(host, 0);
    expect(Number(getComputedStyle(added ?? document.body).opacity)).toBe(0);
    // It never grows: its geometry is B's from the first frame.
    const final = frames.bars.B.find((box) => box.series === "p" && box.day === 11);
    if (final === undefined || added === undefined) throw new Error("no 11 October");
    expectBox(barBox(added, plot), expected(final, plot), "11 October");
    // DOM audit: ticks and grid lines are aria-hidden, so their slots are the only locator.
    const snapped = host.querySelectorAll(
      '[data-slot="chart-x-tick"], [data-slot="chart-y-tick"], [data-slot="chart-grid-line"]'
    );
    expect(snapped.length).toBeGreaterThan(0);
    for (const element of snapped) expect(element.getAnimations()).toEqual([]);
  });
});

describe("Position pairing", () => {
  it("moves B's first nine bars to November's nine and drops the tenth at once", async () => {
    const { host, rerender } = await mounted(MOTION_B);
    rerender(<MotionChart data={MOTION_C} />);
    expect(seriesBars(host, 0)).toHaveLength(9);
    // DOM audit: data-intro is the bars' public entrance attribute.
    expect(host.querySelectorAll('[data-slot="chart-bar"][data-intro="fade"]')).toHaveLength(0);
    const plot = plotOf(host);
    for (const ms of ["120", "240", "360", "480"] as const) {
      seek(host, Number(ms));
      for (const entry of frames.updateC) {
        const bar = seriesBars(host, entry.series === "p" ? 0 : 1)[entry.day - 1];
        if (bar === undefined) throw new Error("no bar");
        expectBox(
          barBox(bar, plot),
          expected(entry.at[ms], plot),
          `${entry.series} ${String(entry.day)} at ${ms}`
        );
      }
    }
  });
});

describe("Reference marks", () => {
  const WINDOW: readonly [Date, Date] = [oslo(10, 1), oslo(10, 11)];

  function marks(data: readonly MotionRow[], range: readonly [Date, Date] = WINDOW) {
    return (
      <MotionChart data={data} xRange={range}>
        <Chart.ReferenceLine y={6} />
        <Chart.ReferenceArea y1={2} y2={4} />
        <Chart.ActiveValue dataKey="p" />
        <Chart.ActiveValueLine dataKey="p">
          <Chart.ValueLabel />
        </Chart.ActiveValueLine>
      </MotionChart>
    );
  }

  /** The reference line's y and the area's edges, in pixels from the plot top. */
  function referenceGeometry(host: HTMLElement) {
    // DOM audit: reference marks are aria-hidden plot output, so their slots are the only locator.
    const line = host.querySelector('[data-slot="chart-reference-line"]') ?? document.body;
    const area = host.querySelector('[data-slot="chart-reference-area"]') ?? document.body;
    const height = area.getBoundingClientRect().height;
    return {
      line: Number.parseFloat(getComputedStyle(line, "::before").top),
      areaTop: Number.parseFloat(getComputedStyle(area, "::before").top),
      areaBottom: height - Number.parseFloat(getComputedStyle(area, "::before").bottom),
    };
  }

  it("moves the line and the area with the bars on update C", async () => {
    const { host, rerender } = renderThemed(marks(MOTION_B));
    await frame();
    settle(host);
    rerender(marks(MOTION_C));
    const plot = plotOf(host);
    // DOM audit: reference marks are aria-hidden plot output.
    for (const slot of ["chart-reference-line", "chart-reference-area"]) {
      const element = host.querySelector(`[data-slot="${slot}"]`);
      const transitions = element?.getAnimations({ subtree: true }) ?? [];
      expect(transitions.length, slot).toBeGreaterThan(0);
      for (const transition of transitions) {
        expect(transition.effect?.getTiming().duration).toBe(480);
        expect(transition.effect?.getTiming().easing).toBe("cubic-bezier(0, 0.7, 0.5, 1)");
      }
    }
    seek(host, 240);
    const geometry = referenceGeometry(host);
    const { references } = frames;
    expect(Math.abs(geometry.line - references.line.at["240"] * plot.height)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(geometry.areaTop - references.areaTop.at["240"] * plot.height)).toBeLessThanOrEqual(
      TOLERANCE
    );
    expect(Math.abs(geometry.areaBottom - references.areaBottom.at["240"] * plot.height)).toBeLessThanOrEqual(
      TOLERANCE
    );
    // In the same frame, the first bar sits on its own 240 ms midpoint.
    const first = frames.updateC.find((entry) => entry.series === "p" && entry.day === 1);
    const bar = seriesBars(host, 0)[0];
    if (first === undefined || bar === undefined) throw new Error("no bar");
    expectBox(barBox(bar, plot), expected(first.at["240"], plot), "first bar");
  });

  it("moves the active value, its line and the line's pill with 7 October on update B", async () => {
    const { host, rerender } = renderThemed(marks(MOTION_A));
    await frame();
    settle(host);
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("7");
    settle(host);
    rerender(marks(MOTION_B));
    const plot = plotOf(host);
    const { activeP7 } = frames;
    for (const ms of ["240", "480"] as const) {
      seek(host, Number(ms));
      // DOM audit: the active value, its line and the pill are aria-hidden plot output.
      const value = host.querySelector('[data-slot="chart-frame"] > [data-slot="chart-active-value"]');
      const line = host.querySelector('[data-slot="chart-active-value-line"]') ?? document.body;
      const pill = line.querySelector('[data-slot="chart-value-label"]');
      const anchor = value?.getBoundingClientRect() ?? new DOMRect();
      const anchorX = anchor.left + anchor.width / 2 - plot.left;
      const anchorY = anchor.bottom + 4 - plot.top;
      expect(Math.abs(anchorX - activeP7.x.at[ms] * plot.width), `value x at ${ms}`).toBeLessThanOrEqual(
        TOLERANCE
      );
      expect(Math.abs(anchorY - activeP7.top.at[ms] * plot.height), `value y at ${ms}`).toBeLessThanOrEqual(
        TOLERANCE
      );
      const lineTop = Number.parseFloat(getComputedStyle(line, "::before").top);
      expect(Math.abs(lineTop - activeP7.top.at[ms] * plot.height), `line at ${ms}`).toBeLessThanOrEqual(
        TOLERANCE
      );
      const pillBox = pill?.getBoundingClientRect() ?? new DOMRect();
      const pillY = pillBox.top + pillBox.height / 2 - plot.top;
      expect(Math.abs(pillY - activeP7.top.at[ms] * plot.height), `pill at ${ms}`).toBeLessThanOrEqual(
        TOLERANCE
      );
    }
  });

  it("moves none of them with a transition on a commit that changes xRange alone", async () => {
    const { host, rerender } = renderThemed(marks(MOTION_B));
    await frame();
    settle(host);
    rerender(marks(MOTION_B, [oslo(10, 3), oslo(10, 11)]));
    expect(rootOf(host).getAnimations({ subtree: true })).toEqual([]);
  });
});

describe("Combined commit", () => {
  it("treats data and xRange together as a data update, and a later range step cancels it", async () => {
    const { host, rerender } = await mounted(MOTION_A, [oslo(10, 1), oslo(10, 10)]);
    rerender(<MotionChart data={MOTION_B} xRange={[oslo(10, 2), oslo(10, 11)]} />);
    const plot = plotOf(host);
    const added = seriesBars(host, 0)[9];
    expect(added?.getAttribute("data-intro")).toBe("fade");
    expect((added?.getAnimations() ?? []).every(isOpacityOrColour)).toBe(true);
    expect(seriesBars(host, 0)).toHaveLength(10);
    expect(Number(getComputedStyle(added ?? document.body).opacity)).toBe(0);
    jump(host, 240);
    for (const entry of frames.updateB) {
      const bar = seriesBars(host, entry.series === "p" ? 0 : 1)[entry.day - 2];
      if (bar === undefined) throw new Error("no bar");
      expectBox(barBox(bar, plot), expected(entry.at["240"], plot), `${entry.series} ${String(entry.day)}`);
    }
    rerender(<MotionChart data={MOTION_B} xRange={[oslo(10, 3), oslo(10, 11)]} />);
    await frame();
    expect(rootOf(host).getAnimations({ subtree: true })).toEqual([]);
    expect(seriesBars(host, 0)).toHaveLength(9);
    const last = seriesBars(host, 0)[8];
    expect(Number(getComputedStyle(last ?? document.body).opacity)).toBe(1);
    for (const box of frames.bars.B3to11) {
      const bar = seriesBars(host, box.series === "p" ? 0 : 1)[box.position];
      if (bar === undefined) throw new Error("no bar");
      expectBox(barBox(bar, plot), expected(box, plot), `B 3 to 11 ${box.series} ${String(box.day)}`);
    }
  });
});

describe("Range steps", () => {
  function month(range: readonly [Date, Date]) {
    return (
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={OCTOBER_RELOAD}
          config={{ kwh: { label: "Forbruk", color: "chart-1" } }}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          xRange={range}
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" />
        </Chart.Root>
      </LocaleProvider>
    );
  }

  it("moves the window from 10–20 to 11–21 October with no geometry animation", async () => {
    expect(OCTOBER_FIRST_LOAD.length).toBe(30);
    const { host, rerender } = renderThemed(month([october(10), october(20)]));
    await frame();
    settle(host);
    rerender(month([october(11), october(21)]));
    await waitFrames(120);
    // DOM audit: bars are aria-hidden plot output.
    const bars = [...host.querySelectorAll('[data-slot="chart-bar"]')];
    expect(bars).toHaveLength(11);
    for (const bar of bars)
      expect(bar.getAnimations().filter((animation) => !isOpacityOrColour(animation))).toEqual([]);
    const entering = bars[10];
    expect(entering?.getAttribute("data-intro")).toBe("none");
    expect(entering?.getAnimations()).toEqual([]);
  });
});
