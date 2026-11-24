// LiveLineChart in Chromium. Unit under test: the whole path from Root's readings to the drawn
// line, the live dot, the badge, the axes, the keyboard walk, the pointer pick, the crosshair, the
// tooltip, the table, pausing, the ticks the axes leave out of their edge fades, the sizers and
// reduced motion. The server HTML is apps/docs' RSC fixture's.
// Oracles: pixels worked out by hand on a 300 by 124 px plot whose 30 s window ends at the latest
// of three readings, 0 at 14:00:00, 50 at 14:00:10 and 100 at 14:00:20 Oslo time, which sit at
// 100, 200 and 300 px across, and whose domain [−12, 112] puts a value v at 112 − v px from the
// top; the line layer's box read against the plot's box and the stroke width the path computes;
// and names, sentences, tick labels and rows written by hand.
import type { ReactNode } from "react";

import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, useFakeFramesAt } from "../../../test/animation-frames";
import { axFocused, axNodes, axProperty } from "../../../test/ax-tree";
import { CaughtError, caughtError } from "../../../test/caught-error";
import { pointerAt } from "../../../test/chart/marks";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import "./chart.css";
import { LiveLineChart } from "./live-line-chart-namespace";
import type { LiveLineChartPoint, LiveLineChartRootProps } from "./live-line-chart-root";

/** 14:00:00 in Oslo on 16 October 2026, under summer time. */
const NOON = Date.UTC(2026, 9, 16, 12);
const SECOND = 1_000;

const READINGS: readonly LiveLineChartPoint[] = [
  { time: NOON, value: 0 },
  { time: new Date(NOON + 10 * SECOND), value: 50 },
  { time: NOON + 20 * SECOND, value: 100 },
];

/** Values in whole numbers. */
const WHOLE = { maximumFractionDigits: 0 } as const;

/**
 * A chart with no axes in Oslo, so its plot is the whole 300 by 124 px frame showing 30 s, unless a
 * case sets the width, window or zone.
 */
function Live({
  data = READINGS,
  value,
  paused = true,
  width = 300,
  windowMs = 30 * SECOND,
  locale = "nb-NO",
  timeZone = "Europe/Oslo",
  valueFormat = WHOLE,
  children,
}: {
  readonly data?: readonly LiveLineChartPoint[];
  readonly value?: number | undefined;
  readonly paused?: boolean;
  readonly width?: number;
  readonly windowMs?: number;
  readonly locale?: SupportedLocale;
  readonly timeZone?: string;
  readonly valueFormat?: LiveLineChartRootProps["valueFormat"];
  readonly children?: ReactNode;
}): ReactNode {
  // Root's value is left out unless the case passes one.
  const latest: Pick<LiveLineChartRootProps, "value"> = {};
  if (value !== undefined) latest.value = value;
  return (
    <LocaleProvider locale={locale} timeZone={timeZone}>
      <button type="button">før</button>
      <div style={{ width }}>
        <LiveLineChart.Root
          data={data}
          {...latest}
          windowMs={windowMs}
          label="Pris"
          valueFormat={valueFormat}
          paused={paused}
          aria-label="Spotpris nå"
          style={{ "--chart-plot-height": "124px" }}>
          {children ?? (
            <>
              <LiveLineChart.Line curve="linear" />
              <LiveLineChart.LiveDot />
              <LiveLineChart.Crosshair />
              <LiveLineChart.Tooltip />
              <LiveLineChart.Table />
            </>
          )}
        </LiveLineChart.Root>
      </div>
    </LocaleProvider>
  );
}

/** The line's `d`. The line is aria-hidden plot output, so its slot is the only locator. */
function lineD(host: HTMLElement): string | null {
  return host.querySelector('[data-slot="live-line-chart-line-path"]')?.getAttribute("d") ?? null;
}

/** The live dot's place. The dot is aria-hidden plot output, so its slot is the only locator. */
function dotAt(host: HTMLElement): string | null {
  return host.querySelector('[data-slot="live-line-chart-live-dot"] > g')?.getAttribute("transform") ?? null;
}

/** The crosshair's ring's place, or null while it hides. It is aria-hidden plot output, so its slot locates it. */
function crosshairAt(host: HTMLElement): string | null {
  const group = host.querySelector('[data-slot="live-line-chart-crosshair"] > g');
  if (group === null || group.hasAttribute("data-hidden")) return null;
  return group.querySelector('[data-slot="chart-dot"]')?.getAttribute("transform") ?? null;
}

/** The crosshair's rule. It is aria-hidden plot output, so its slot locates it. */
function crosshairRule(host: HTMLElement): SVGLineElement {
  const rule = host.querySelector('[data-slot="live-line-chart-crosshair-rule"]');
  if (!(rule instanceof SVGLineElement)) throw new Error("the crosshair has no rule");
  return rule;
}

/** The plot's box, which the crosshair's rule spans. */
function plotBox(host: HTMLElement): DOMRect {
  const plot = host.querySelector('[data-slot="chart-plot"]');
  if (plot === null) throw new Error("the plot is missing");
  return plot.getBoundingClientRect();
}

/** The tooltip's popup, or null while it is closed. It is aria-hidden, so its slot locates it. */
function tooltipPopup(host: HTMLElement): HTMLElement | null {
  return host.querySelector<HTMLElement>('[data-slot="live-line-chart-tooltip"] [data-slot="chart-tooltip"]');
}

/** The tooltip's text, or null while it is closed. The popup is aria-hidden, so its slot locates it. */
function tooltipText(host: HTMLElement): string | null {
  return (
    host.querySelector('[data-slot="live-line-chart-tooltip"] [data-slot="chart-tooltip"]')?.textContent ??
    null
  );
}

/** The focused option's name, position and set size. */
function focused(): readonly [string | null, string | null, string | null] {
  const element = document.activeElement;
  return [
    element?.getAttribute("aria-label") ?? null,
    element?.getAttribute("aria-posinset") ?? null,
    element?.getAttribute("aria-setsize") ?? null,
  ];
}

/**
 * Freeze the wall clock at an instant for the rest of the test, so the live window Root ends at
 * `Date.now()` holds still while animation frames keep running.
 */
function freezeWallClock(at: number): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(at);
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** The time axis's ticks, each label with its computed opacity. */
function xTickOpacities(host: HTMLElement): (readonly [string, number])[] {
  return [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].map(
    (tick) => [tick.textContent, Number(getComputedStyle(tick).opacity)] as const
  );
}

/** The value ticks or grid lines of a slot still in their list, the leaving ones left out. */
function staying(host: HTMLElement, slot: "chart-y-tick" | "chart-grid-line"): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(`[data-slot="${slot}"]:not([data-leaving])`)];
}

/** The labels of the value ticks still in the axis's list. */
function labelsOf(host: HTMLElement): string[] {
  return staying(host, "chart-y-tick").map((tick) => tick.textContent);
}

/** A chart of the value guides alone: the grid and the value axis. */
function Guides({
  data = READINGS,
  paused,
}: {
  readonly data?: readonly LiveLineChartPoint[];
  readonly paused: boolean;
}): ReactNode {
  return (
    <Live data={data} paused={paused}>
      <LiveLineChart.Grid />
      <LiveLineChart.YAxis />
    </Live>
  );
}

/** A paused 150 px chart of the time axis alone, whose window ends at a last reading of 100. */
function NarrowTimeAxis({ end }: { readonly end: number }): ReactNode {
  return (
    <Live width={150} data={[...READINGS, { time: end, value: 100 }]}>
      <LiveLineChart.XAxis />
    </Live>
  );
}

afterEach(async () => {
  await emulateReducedMotion("no-preference");
});

describe("LiveLineChart Root", () => {
  it("draws the window's readings and puts the live dot on the right edge at the latest value", async () => {
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).toBe("M100,112L200,62L300,12");
    expect(dotAt(host)).toBe("translate(300 12)");
  });

  it("throws a composition error for a chart with no zone", () => {
    renderThemed(
      <CaughtError>
        <LocaleProvider locale="nb-NO">
          <LiveLineChart.Root data={READINGS} aria-label="Spotpris nå" />
        </LocaleProvider>
      </CaughtError>
    );
    expect(caughtError().message).toContain("time zone");
  });

  it("throws a composition error for a window that is not a positive length", () => {
    renderThemed(
      <CaughtError>
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <LiveLineChart.Root data={READINGS} windowMs={0} aria-label="Spotpris nå" />
        </LocaleProvider>
      </CaughtError>
    );
    expect(caughtError().message).toContain("received windowMs 0");
  });
});

describe("the line", () => {
  it("lays its layer half a stroke past the plot's top and bottom edges, its viewport on the plot", async () => {
    // The clock widens the domain to a value at once, so for a frame the line can run along an
    // edge. The layer's border box, which its mask paints, holds the stroke's outer half there, and
    // its content box, the SVG viewport the clock draws in, stays the plot.
    const { host } = renderThemed(
      <Live>
        <LiveLineChart.Line curve="linear" />
      </Live>
    );
    await expect.poll(() => lineD(host)).not.toBeNull();
    const layer = host.querySelector('[data-slot="live-line-chart-line"]');
    const path = host.querySelector('[data-slot="live-line-chart-line-path"]');
    const plot = host.querySelector('[data-slot="chart-plot"]');
    if (layer === null || path === null || plot === null) throw new Error("the line or the plot is missing");
    const half = Number.parseFloat(getComputedStyle(path).strokeWidth) / 2;
    expect(half).toBeGreaterThan(0);
    const border = layer.getBoundingClientRect();
    const target = plot.getBoundingClientRect();
    expect(border.top).toBeCloseTo(target.top - half, 3);
    expect(border.bottom).toBeCloseTo(target.bottom + half, 3);
    const padding = getComputedStyle(layer);
    expect(border.top + Number.parseFloat(padding.paddingTop)).toBeCloseTo(target.top, 3);
    expect(border.bottom - Number.parseFloat(padding.paddingBottom)).toBeCloseTo(target.bottom, 3);
    expect(border.left).toBeCloseTo(target.left, 3);
    expect(border.right).toBeCloseTo(target.right, 3);
  });
});

describe("the axes", () => {
  it("labels the paused window's round times and the domain's nice values, less the ticks at rest in a fade", async () => {
    // A 400 px chart leaves the plot room for three to five time labels, so the axis steps 10 s:
    // the window from 13:59:50 to 14:00:20 holds ticks at both ends and every 10 s between. The
    // ticks at both ends sit on the plot's edges, inside the 40 px fades, and the axis leaves them
    // out. The domain [−12, 112] ticks at d3's step of 20 from 0 to 100, and 0 and 100 sit 12 px
    // from the plot's bottom and top, inside the 16 px fades, so the axis and the grid leave them out.
    const { host } = renderThemed(
      <Live width={400}>
        <LiveLineChart.Grid />
        <LiveLineChart.YAxis />
        <LiveLineChart.XAxis />
      </Live>
    );
    const xTicks = () =>
      [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-axis"] [data-slot="chart-x-tick"]')].map(
        (tick) => [tick.textContent, Number.parseFloat(tick.style.getPropertyValue("--chart-at"))] as const
      );
    await expect.poll(() => xTicks().length).toBe(2);
    const ticks = xTicks();
    expect(ticks.map(([label]) => label)).toEqual(["14:00:00", "14:00:10"]);
    const places = [1 / 3, 2 / 3];
    for (const [index, [, at]] of ticks.entries()) expect(at).toBeCloseTo(places[index] ?? Number.NaN, 9);
    const yTicks = [
      ...host.querySelectorAll('[data-slot="chart-y-axis"] [data-part="ticks"] [data-slot="chart-y-tick"]'),
    ].map((tick) => tick.textContent);
    expect(yTicks).toEqual(["20", "40", "60", "80"]);
    expect(host.querySelectorAll('[data-slot="chart-grid-line"]')).toHaveLength(4);
  });

  it("leaves out a value tick that comes to rest in the fade, and keeps one the domain carries out until it leaves", async () => {
    // Readings 0, 50 and 120 rest the domain at [−14.4, 134.4], whose step of 20 puts 0 and 120
    // 12 px from the plot's edges, inside the 16 px fades. A correction of 120 to 82 sends the
    // domain inward over 900 ms, to rest at [−9.84, 91.84], at the same step, where 80 rests
    // (91.84 − 80) / 101.68 × 124 = 14.4 px from the top, inside the fade, and 100 and 120 lie
    // beyond it. The glide starts from [−14.4, 134.4], where 100 sits (134.4 − 100) / 148.8 × 124
    // ≈ 28.7 px from the top, opaque, and 120 sits in the fade.
    const step = useFakeFramesAt(NOON + 22 * SECOND);
    const latest = (value: number) => [...READINGS.slice(0, 2), { time: NOON + 20 * SECOND, value }];
    const { host, rerender } = renderThemed(<Guides data={latest(120)} paused={false} />);
    const hundred = () => staying(host, "chart-y-tick").find((tick) => tick.textContent === "100");
    await expect.poll(() => labelsOf(host)).toEqual(["20", "40", "60", "80", "100"]);
    // A frame of the running clock, which the correction's glide starts from.
    step(1);
    rerender(<Guides data={latest(82)} paused={false} />);
    step(1);
    expect(labelsOf(host)).toEqual(["20", "40", "60", "100"]);
    expect(staying(host, "chart-grid-line")).toHaveLength(4);
    expect(hundred()?.style.opacity).toBe("1");
    // 100 fades as the domain carries it to the top edge, and stays in the axis and the grid while
    // it does.
    const fades: (readonly [number, number])[] = [];
    for (let frame = 0; frame < 60 && hundred() !== undefined; frame += 1) {
      step(1);
      fades.push([Number(hundred()?.style.opacity ?? Number.NaN), staying(host, "chart-grid-line").length]);
    }
    expect(fades.find(([opacity]) => opacity > 0 && opacity < 1)).toEqual([expect.any(Number), 4]);
    step(60);
    expect(labelsOf(host)).toEqual(["20", "40", "60"]);
    expect(staying(host, "chart-grid-line")).toHaveLength(3);
  });

  it("fades a time tick at the right edge while the window scrolls, and leaves it out once paused", async () => {
    // At 14:00:22 the 30 s window runs from 13:59:52, so the 300 px plot puts 14:00:00 at 80 px,
    // 14:00:10 at 180 px and 14:00:20 at 280 px, halfway into the right edge's 40 px fade.
    freezeWallClock(NOON + 22 * SECOND);
    const chart = (paused: boolean) => (
      <Live paused={paused}>
        <LiveLineChart.XAxis />
      </Live>
    );
    const { host, rerender } = renderThemed(chart(false));
    await expect
      .poll(() => xTickOpacities(host).map(([label]) => label))
      .toEqual(["14:00:00", "14:00:10", "14:00:20"]);
    expect(xTickOpacities(host).at(-1)?.[1]).toBeCloseTo(0.5, 6);
    rerender(chart(true));
    await expect
      .poll(() => xTickOpacities(host))
      .toEqual([
        ["14:00:00", 1],
        ["14:00:10", 1],
      ]);
  });

  it("keeps a still window's one time tick, opaque in the fade, when its label fits", async () => {
    // A paused 150 px plot holds the 30 s window that ends at its latest reading, and leaves room
    // for one label, so the axis steps 30 s. Ending at 14:00:24, its one tick, 14:00:00, sits 6 s
    // in, 30 px from the left edge, inside the 40 px fade, and its label, at most 58 px wide, fits
    // centered there. Ending at 14:00:28, the tick sits 10 px in, where the label does not fit.
    const fits = renderThemed(<NarrowTimeAxis end={NOON + 24 * SECOND} />).host;
    const overflows = renderThemed(<NarrowTimeAxis end={NOON + 28 * SECOND} />).host;
    await expect.poll(() => xTickOpacities(fits)).toEqual([["14:00:00", 1]]);
    expect(xTickOpacities(overflows)).toEqual([]);
  });

  it("fits the one time tick it keeps at the axis's font size", async () => {
    // At 12 px, "14:00:00" draws at most 58 px wide in a common sans: six digits of up to 8 px and
    // two colons of up to 5 px. A 20 px root draws the 0.75rem labels at 15 px, where the bound is
    // 72.5 px, so the label needs 36.25 px on either side. Ending at 14:00:23.6, the 150 px plot's
    // one tick sits 32 px from the left edge, where the 12 px label fits and the 15 px one may not:
    // Inter draws it 66.4 px wide there, 1.2 px past the edge. Ending at 14:00:22.2, the tick sits
    // 39 px in, inside the 40 px fade, where the 15 px label fits.
    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });
    const narrow = renderThemed(<NarrowTimeAxis end={NOON + 23.6 * SECOND} />).host;
    await expect.poll(() => xTickOpacities(narrow)).toEqual([["14:00:00", 1]]);
    document.documentElement.style.fontSize = "20px";
    await expect.poll(() => xTickOpacities(narrow)).toEqual([]);
    const wide = renderThemed(<NarrowTimeAxis end={NOON + 22.2 * SECOND} />).host;
    await expect.poll(() => xTickOpacities(wide)).toEqual([["14:00:00", 1]]);
    const axis = wide.querySelector('[data-slot="chart-x-axis"]')?.getBoundingClientRect();
    const label = wide.querySelector('[data-slot="chart-x-tick"]')?.getBoundingClientRect();
    expect(label?.left).toBeGreaterThanOrEqual(axis?.left ?? Number.NaN);
    expect(label?.right).toBeLessThanOrEqual(axis?.right ?? Number.NaN);
  });

  /** Set the root font size for the rest of the test. */
  function rootFontSize(size: string): void {
    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });
    document.documentElement.style.fontSize = size;
  }

  /** The room between neighboring time labels, left to right, in CSS pixels. */
  function xTickGaps(host: HTMLElement): number[] {
    const boxes = [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-tick"]')].map((tick) =>
      tick.getBoundingClientRect()
    );
    return boxes.slice(1).map((next, index) => next.left - (boxes[index]?.right ?? Number.NaN));
  }

  it.each(["16px", "32px"])("keeps a still window's one time tick at a %s root", async (size) => {
    // A paused 180 px plot ending at 14:00:32 holds 14:00:02 to 14:00:32. At a 16 px root the axis
    // steps 15 s, and 14:00:15 sits 78 px in, out of the fade. At a 32 px root the labels draw at
    // 24 px and leave room for one, so the axis steps 30 s, and its one tick, 14:00:30, sits 12 px
    // from the right edge, where no label fits. The 15 s step's 14:00:15 still does: its label is
    // at most 116 px wide at 24 px, 58 px on either side of a tick 78 px in.
    rootFontSize(size);
    const { host } = renderThemed(
      <Live width={180} data={[...READINGS, { time: NOON + 32 * SECOND, value: 100 }]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    await expect.poll(() => xTickOpacities(host)).toEqual([["14:00:15", 1]]);
  });

  it.each([30, 180])(
    "keeps 32 px between time labels of a %i s window at a larger root font size",
    async (seconds) => {
      // A 32 px root draws the 0.75rem labels at 24 px, where "14:00:00" is 85 to 93 px wide in a
      // common sans. On the paused 600 px plot, a 5 s step in the 30 s window, or a 30 s step in the
      // 180 s one, puts its ticks 100 px apart, at most 15 px between labels, so the axis must step
      // wider for the labels to keep the 32 px it plans.
      rootFontSize("32px");
      const { host } = renderThemed(
        <Live width={600} windowMs={seconds * SECOND}>
          <LiveLineChart.XAxis />
        </Live>
      );
      await expect.poll(() => xTickGaps(host).length).toBeGreaterThan(0);
      for (const gap of xTickGaps(host)) expect(gap).toBeGreaterThanOrEqual(32);
    }
  );

  it("keeps no finer step's tick while the window scrolls at a larger root font size", async () => {
    // A 32 px root draws the labels at 24 px, so the 240 px plot of a 20 s window steps 30 s. The
    // window from 14:00:09.9 to 14:00:29.9 holds no tick of that step. Paused, it keeps the 15 s
    // step's 14:00:15, 61 px in, where the label fits. Scrolling, the axis shows only its own
    // step's ticks, which enter at the right edge in the fade, so it keeps none.
    rootFontSize("32px");
    const end = NOON + 29.9 * SECOND;
    freezeWallClock(end);
    const chart = (paused: boolean) => (
      <Live
        width={240}
        windowMs={20 * SECOND}
        paused={paused}
        data={[...READINGS, { time: end, value: 100 }]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    const { host, rerender } = renderThemed(chart(true));
    await expect.poll(() => xTickOpacities(host)).toEqual([["14:00:15", 1]]);
    rerender(chart(false));
    await expect.poll(() => xTickOpacities(host)).toEqual([]);
  });

  it.each([
    ["12px", 140],
    ["15px", 152],
  ])("keeps the step's own tick in the fade at a %s root when its label fits", async (size, width) => {
    // A 12 px root draws the 0.75rem labels at 9 px, and a 15 px root at 11.25 px, so the paused
    // plot steps 15 s, finer than the 30 s that 12 px labels take. The window from 13:59:52.5 to
    // 14:00:22.5 puts 14:00:00 and 14:00:15 a quarter of the plot from either edge, 35 or 38 px,
    // inside the 40 px fade. The label is at most 58 px wide at 12 px, so at most 43.5 or 54.4 px
    // here, and fits centered on either tick.
    rootFontSize(size);
    const { host } = renderThemed(
      <Live width={width} data={[...READINGS, { time: NOON + 22.5 * SECOND, value: 100 }]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    await expect.poll(() => xTickOpacities(host)).toEqual([["14:00:00", 1]]);
  });

  it.each([
    [220, 60],
    [180, 65],
  ])(
    "keeps a 30 s tick, in seconds, on a paused %i px plot whose minute ticks sit at its edges",
    async (width, end) => {
      // A 32 px root draws the labels at 24 px, so the 60 s window steps 60 s. Ending at 14:01:00,
      // its ticks sit on both edges; ending at 14:01:05, 14:01:00 sits 15 px from the right edge,
      // where no label fits. The 30 s step's 14:00:30 sits 110 or 75 px in, where the label, at
      // most 116 px wide at 24 px, fits, and it prints its seconds.
      rootFontSize("32px");
      const { host } = renderThemed(
        <Live
          width={width}
          windowMs={60 * SECOND}
          data={[...READINGS, { time: NOON + end * SECOND, value: 100 }]}>
          <LiveLineChart.XAxis />
        </Live>
      );
      await expect.poll(() => xTickOpacities(host)).toEqual([["14:00:30", 1]]);
    }
  );

  it("keeps a finer step's tick in the axis's own format at a larger root font size", async () => {
    // A 32 px root draws the labels at 24 px. The paused 150 px plot from 14:00:10 to 14:01:10 steps
    // 60 s, and 14:01:00 sits 25 px from the right edge, where no label fits. With minute labels,
    // the 30 s step's 14:00:30 sits 50 px in, and "14:00", at most 72 px wide at 24 px, fits
    // centered on it. "14:00:30" would need up to 58 px on either side.
    rootFontSize("32px");
    const { host } = renderThemed(
      <Live width={150} windowMs={60 * SECOND} data={[...READINGS, { time: NOON + 70 * SECOND, value: 100 }]}>
        <LiveLineChart.XAxis format="time" />
      </Live>
    );
    await expect.poll(() => xTickOpacities(host)).toEqual([["14:00", 1]]);
  });

  it("keeps a still window's 30 s tick at a 16 px root, as the 12 px step would", async () => {
    // A 16 px root draws the labels at 12 px. The paused 150 px plot of a 50 s window from 14:00:00
    // to 14:00:50 fits one seconds label, so it steps 60 s, and 14:00:00 sits on the left edge.
    // The minute labels would fit the 30 s step, whose 14:00:30 sits 90 px in, where the label,
    // at most 58 px wide, fits.
    rootFontSize("16px");
    const { host } = renderThemed(
      <Live width={150} windowMs={50 * SECOND} data={[...READINGS, { time: NOON + 50 * SECOND, value: 100 }]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    await expect.poll(() => xTickOpacities(host)).toEqual([["14:00:30", 1]]);
  });

  it("keeps the tick nearest the middle whose label fits when the nearest one's does not", async () => {
    // At a 16 px root, the paused 190 px plot from 9:59:39.61 to 10:00:05.52 AM in New York steps
    // 15 s. 10:00:00 AM sits 40.48 px from the right edge, where its label needs up to 43.56 px on
    // either side. 9:59:45 AM sits 39.53 px from the left edge and needs up to 39.31 px. Fuse writes
    // the space before AM as U+00A0.
    rootFontSize("16px");
    // 10:00 AM in New York, under summer time.
    const ten = NOON + 2 * 3_600 * SECOND;
    const end = ten + 5.52 * SECOND;
    const { host } = renderThemed(
      <Live
        locale="en-US"
        timeZone="America/New_York"
        width={190}
        windowMs={25.91 * SECOND}
        data={[
          { time: ten - 20 * SECOND, value: 0 },
          { time: end, value: 100 },
        ]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    await expect.poll(() => xTickOpacities(host)).toEqual([["9:59:45\u00a0AM", 1]]);
  });

  it("reads the axis's font size again when its style changes", async () => {
    // The paused 600 px plot of a 30 s window steps 5 s with 12 px labels. A 24 px style.fontSize
    // leaves the axis's box the same size, and "14:00:00" is then 85 to 93 px wide, so ticks 100 px
    // apart would leave at most 15 px between labels.
    const chart = (fontSize: string) => (
      <Live width={600}>
        <LiveLineChart.XAxis style={{ fontSize }} />
      </Live>
    );
    const { host, rerender } = renderThemed(chart("12px"));
    await expect.poll(() => xTickGaps(host).length).toBeGreaterThan(3);
    // The observer reports the axis once after it starts, so the change waits out that report.
    await nextFrames(2);
    rerender(chart("24px"));
    await expect.poll(() => xTickGaps(host).every((gap) => gap >= 32)).toBe(true);
    expect(xTickGaps(host).length).toBeGreaterThan(0);
  });

  it("leaves out a resting time tick out of the fade whose label at the axis's font size crosses the edge", async () => {
    // A 32 px root draws the labels at 24 px, where "14:00:15" is at most 116 px wide. The paused
    // 360 px plot from 14:00:11.4 to 14:00:41.4 steps 15 s. 14:00:15 sits 43.2 px in, out of the
    // 40 px fade, but its label needs up to 58 px on either side. 14:00:30 sits 223.2 px in.
    rootFontSize("32px");
    const { host } = renderThemed(
      <Live width={360} data={[...READINGS, { time: NOON + 41.4 * SECOND, value: 100 }]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    await expect.poll(() => xTickOpacities(host)).toEqual([["14:00:30", 1]]);
  });

  it("leaves out a time tick in the fade while the clock holds the live window behind a decaying lead", async () => {
    // A reading stamped 14:00:52, 32 s ahead of the wall clock at 14:00:20, sets a lead of 32 s, and
    // the window runs from 14:00:22 to 14:00:52, which puts 14:00:50 at 280 px, halfway into the
    // 300 px plot's 40 px fade at the right edge. The feed then restamps the reading 14:00:20, and
    // 1 s on the lead has decayed to 32 × 2^(−0.1) ≈ 29.86 s. The wall clock and the lead reach
    // 14:00:50.86, behind the window's end, so the clock holds the window at 14:00:52. At 14:01:00
    // the lead is 32 × 2^(−4) = 2 s, the window ends at 14:01:02 and scrolls again, and 14:01:00
    // sits 20 px from the right edge, halfway into the fade.
    freezeWallClock(NOON + 20 * SECOND);
    const chart = (latest: number) => (
      <Live data={[...READINGS.slice(0, 2), { time: latest, value: 100 }]} paused={false}>
        <LiveLineChart.XAxis />
      </Live>
    );
    const { host, rerender } = renderThemed(chart(NOON + 52 * SECOND));
    await expect
      .poll(() => xTickOpacities(host).map(([label]) => label))
      .toEqual(["14:00:30", "14:00:40", "14:00:50"]);
    expect(xTickOpacities(host).at(-1)?.[1]).toBeCloseTo(0.5, 6);
    rerender(chart(NOON + 20 * SECOND));
    vi.setSystemTime(NOON + 21 * SECOND);
    await expect
      .poll(() => xTickOpacities(host))
      .toEqual([
        ["14:00:30", 1],
        ["14:00:40", 1],
      ]);
    vi.setSystemTime(NOON + 60 * SECOND);
    await expect
      .poll(() => xTickOpacities(host).map(([label]) => label))
      .toEqual(["14:00:40", "14:00:50", "14:01:00"]);
    expect(xTickOpacities(host).at(-1)?.[1]).toBeCloseTo(0.5, 6);
  });
});

describe("the time axis in a zone off the hour", () => {
  it("ticks on the zone's round half hours, not UTC's", async () => {
    // Kathmandu runs 5 h 45 min ahead of UTC, which no tick step of 30 min or more divides. A paused
    // 3 h window ending at 08:00 UTC shows 10:45 to 13:45 there, and a 400 px chart leaves room for
    // six to eleven labels, so the axis steps 30 min: 11:00 to 13:30, the first a quarter of an hour
    // into the window and each next one half an hour on, at (0.25 + 0.5 k) / 3 of its width. Ticks
    // on UTC's half hours would sit at 0, 1/6, … 1 and read 10:45, 11:15, … The paused axis leaves
    // out 11:00 and 13:30, which rest 1/12 of the 400 px plot, 33 px, inside its 40 px edge fades.
    const HOUR = 3_600 * SECOND;
    const end = Date.UTC(2026, 9, 16, 8);
    const { host } = renderThemed(
      <Live
        width={400}
        windowMs={3 * HOUR}
        timeZone="Asia/Kathmandu"
        data={[
          { time: end - 2 * HOUR, value: 0 },
          { time: end - HOUR, value: 50 },
          { time: end, value: 100 },
        ]}>
        <LiveLineChart.XAxis />
      </Live>
    );
    const xTicks = () =>
      [...host.querySelectorAll<HTMLElement>('[data-slot="chart-x-axis"] [data-slot="chart-x-tick"]')].map(
        (tick) => [tick.textContent, Number.parseFloat(tick.style.getPropertyValue("--chart-at"))] as const
      );
    await expect.poll(() => xTicks().length).toBe(4);
    const ticks = xTicks();
    expect(ticks.map(([label]) => label)).toEqual(["11:30", "12:00", "12:30", "13:00"]);
    const places = [3 / 12, 5 / 12, 7 / 12, 9 / 12];
    for (const [index, [, at]] of ticks.entries()) expect(at).toBeCloseTo(places[index] ?? Number.NaN, 9);
  });
});

describe("the readout", () => {
  async function enterChart(): Promise<void> {
    await userEvent.click(page.getByRole("button", { name: "før" }));
    await userEvent.keyboard("{Tab}");
  }

  it("walks the window's readings from the latest, with the tooltip on the walked one, and Escape leaves the option focused and unselected", async () => {
    const { host } = renderThemed(<Live />);
    await enterChart();
    expect(roleNamed("listbox", "Spotpris nå, datapunkter")).not.toBeNull();
    expect(focused()).toEqual(["kl. 14:00:20, Pris: 100", "3", "3"]);
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()).toEqual(["kl. 14:00:10, Pris: 50", "2", "3"]);
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    // The paused chart runs no frame, and the step still draws the crosshair on the reading.
    expect(crosshairAt(host)).toBe("translate(200 62)");
    await userEvent.keyboard("{Home}");
    expect(focused()[1]).toBe("1");
    // The walk stops at its ends.
    await userEvent.keyboard("{ArrowLeft}");
    expect(focused()[1]).toBe("1");
    await userEvent.keyboard("{End}");
    expect(focused()[1]).toBe("3");
    expect(page.getByRole("option").all()).toHaveLength(1);
    await expect.poll(() => tooltipText(host)).toBe("14:00:20Pris100");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => tooltipText(host)).toBeNull();
    // Chromium's accessibility tree reports the focused option as unselected.
    const focusedNode = axFocused(await axNodes());
    expect(focusedNode?.role?.value).toBe("option");
    expect(axProperty(focusedNode ?? { nodeId: "" }, "selected")).toBe(false);
  });

  it("counts only the readings the window shows in the option's position and set size", async () => {
    // Two readings before the window, at 13:59:20 and 13:59:25, and the three inside it.
    renderThemed(
      <Live
        data={[{ time: NOON - 40 * SECOND, value: 20 }, { time: NOON - 35 * SECOND, value: 30 }, ...READINGS]}
      />
    );
    await enterChart();
    await userEvent.keyboard("{End}");
    expect(focused()).toEqual(["kl.\u00a014:00:20, Pris: 100", "3", "3"]);
    await userEvent.keyboard("{Home}");
    expect(focused()).toEqual(["kl.\u00a014:00:00, Pris: 0", "1", "3"]);
  });

  it("counts every reading when the live window shows none, as Home walks them all", async () => {
    // At 14:01:40 the three readings are 100, 90 and 80 s old, all before the live 30 s window.
    freezeWallClock(NOON + 100 * SECOND);
    renderThemed(<Live paused={false} />);
    await enterChart();
    await nextFrames(3);
    expect(focused()).toEqual(["kl.\u00a014:00:20, Pris: 100", "3", "3"]);
    await userEvent.keyboard("{Home}");
    await nextFrames(3);
    expect(focused()).toEqual(["kl.\u00a014:00:00, Pris: 0", "1", "3"]);
  });

  it("names the latest reading, at its position, once the feed drops the walked one", async () => {
    // At 14:00:20 the live 30 s window shows all three readings.
    freezeWallClock(NOON + 20 * SECOND);
    const { rerender } = renderThemed(<Live paused={false} />);
    await enterChart();
    await userEvent.keyboard("{ArrowLeft}");
    await nextFrames(3);
    expect(focused()).toEqual(["kl.\u00a014:00:10, Pris: 50", "2", "3"]);
    // The feed drops the walked reading while the window still spans its instant.
    rerender(<Live paused={false} data={[...READINGS.slice(0, 1), ...READINGS.slice(2)]} />);
    await nextFrames(3);
    expect(focused()).toEqual(["kl.\u00a014:00:20, Pris: 100", "2", "2"]);
  });

  it("names the latest reading once the feed drops the oldest one the walk reached", async () => {
    // At 14:00:20 the live 30 s window shows all three readings.
    freezeWallClock(NOON + 20 * SECOND);
    const { rerender } = renderThemed(<Live paused={false} />);
    await enterChart();
    await userEvent.keyboard("{Home}");
    await nextFrames(3);
    expect(focused()).toEqual(["kl.\u00a014:00:00, Pris: 0", "1", "3"]);
    // The feed drops the walked reading, the window's oldest, while the window still spans its instant.
    rerender(<Live paused={false} data={READINGS.slice(1)} />);
    await nextFrames(3);
    expect(focused()).toEqual(["kl.\u00a014:00:20, Pris: 100", "2", "2"]);
  });

  it("puts the latest reading's crosshair and option where the line ends, on Root's value", async () => {
    // A paused chart ends at the latest reading, which draws at Root's 200: the domain fits [0, 200]
    // as [−24, 224], so 200 sits (224 − 200) / 2 = 12 px down, at the right edge.
    const { host } = renderThemed(<Live value={200} />);
    await enterChart();
    expect(focused()[1]).toBe("3");
    await userEvent.keyboard("{End}");
    expect(crosshairAt(host)).toBe("translate(300 12)");
    expect(dotAt(host)).toBe("translate(300 12)");
    // The option centers on the reading, where the crosshair rings it.
    const option = page.getByRole("option").element().getBoundingClientRect();
    const ring = host.querySelector('[data-slot="live-line-chart-crosshair"] [data-slot="chart-dot"]');
    const rung = ring?.getBoundingClientRect();
    expect(option.left + option.width / 2).toBeCloseTo((rung?.left ?? 0) + (rung?.width ?? 0) / 2, 2);
    expect(option.top + option.height / 2).toBeCloseTo((rung?.top ?? 0) + (rung?.height ?? 0) / 2, 2);
  });

  it("lands a key step at once: the crosshair on the reading, and the tooltip with no entrance", async () => {
    const { host } = renderThemed(<Live />);
    await enterChart();
    await userEvent.keyboard("{ArrowLeft}");
    // No frame runs on the paused chart, and the crosshair already rests on the reading at 200 px,
    // where 50 sits 112 − 50 = 62 px down, with nothing running to carry it there.
    expect(crosshairAt(host)).toBe("translate(200 62)");
    const crosshair = host.querySelector('[data-slot="live-line-chart-crosshair"]');
    expect(crosshair?.getAnimations({ subtree: true })).toEqual([]);
    const popup = tooltipPopup(host);
    expect(popup === null ? null : getComputedStyle(popup).animationName).toBe("none");
  });

  it("opens the tooltip from the pointer with its entrance", async () => {
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = plotBox(host);
    await pointerAt(box.left + 190, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    const popup = tooltipPopup(host);
    expect(popup === null ? null : getComputedStyle(popup).animationName).not.toBe("none");
  });

  it("stands the crosshair at the pointer, its ring on the line, while the tooltip names the nearest reading", async () => {
    // At 160 px the line runs 60 % of the way from 0 at 100 px to 50 at 200 px, so the ring sits on
    // 30, 112 − 30 = 82 px down. At 170 px it sits on 35, 77 px down. The reading at 200 px is the
    // nearest at both, so the crosshair moves with no new reading to name.
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = plotBox(host);
    await pointerAt(box.left + 160, box.top + 60);
    await expect.poll(() => crosshairAt(host)).toBe("translate(160 82)");
    expect(crosshairRule(host).getAttribute("transform")).toBe("translate(160 0)");
    expect(tooltipText(host)).toBe("14:00:10Pris50");
    await pointerAt(box.left + 170, box.top + 60);
    await nextFrames(1);
    expect(crosshairRule(host).getAttribute("transform")).toBe("translate(170 0)");
    expect(crosshairAt(host)).toBe("translate(170 77)");
    expect(tooltipText(host)).toBe("14:00:10Pris50");
    const crosshair = host.querySelector('[data-slot="live-line-chart-crosshair"]');
    expect(crosshair?.getAnimations({ subtree: true })).toEqual([]);
  });

  it("zooms the tooltip from the crosshair where the plot's edge holds it in", async () => {
    // At 6 px from either edge the popup, wider than 12 px, keeps inside the plot: at the left edge
    // its box starts at 0, so the crosshair stands 6 px into it, and at the right edge its box ends
    // at 300 px, so the crosshair stands 6 px short of its width. It zooms from there, at its bottom.
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = plotBox(host);
    await pointerAt(box.left + 6, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:00Pris0");
    const popup = tooltipPopup(host);
    if (popup === null) throw new Error("the tooltip did not open");
    const origin = () => getComputedStyle(popup).transformOrigin.split(" ").map(Number.parseFloat);
    const size = () => {
      const { width, height } = getComputedStyle(popup);
      return [Number.parseFloat(width), Number.parseFloat(height)] as const;
    };
    const [width, height] = size();
    expect(width).toBeGreaterThan(12);
    expect(origin()[0]).toBeCloseTo(6, 2);
    expect(origin()[1]).toBeCloseTo(height, 2);
    await pointerAt(box.left + 294, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:20Pris100");
    const [wide, tall] = size();
    expect(origin()[0]).toBeCloseTo(wide - 6, 2);
    expect(origin()[1]).toBeCloseTo(tall, 2);
  });

  it("names what a paused plot shows while the feed moves on and drops the shown readings", async () => {
    const { host, rerender } = renderThemed(
      <Live>
        <LiveLineChart.Line curve="linear" />
        <LiveLineChart.Badge />
        <LiveLineChart.Tooltip />
      </Live>
    );
    await enterChart();
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    const held = lineD(host);
    expect(held).not.toBeNull();
    // The feed moves a minute on, and no reading the paused plot shows is left in it.
    rerender(
      <Live data={[{ time: NOON + 80 * SECOND, value: 7 }]}>
        <LiveLineChart.Line curve="linear" />
        <LiveLineChart.Badge />
        <LiveLineChart.Tooltip />
      </Live>
    );
    expect(lineD(host)).toBe(held);
    expect(tooltipText(host)).toBe("14:00:10Pris50");
    expect(focused()).toEqual(["kl.\u00a014:00:10, Pris: 50", "2", "3"]);
    const badge = host.querySelector('[data-slot="live-line-chart-badge"] [data-slot="chart-axis-sizer"]');
    expect(badge?.textContent).toBe("100");
  });

  it("picks the reading nearest the pointer and lets go when the pointer leaves", async () => {
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = roleNamed("listbox", "Spotpris nå, datapunkter").getBoundingClientRect();
    // 190 px across sits nearest the reading at 200 px.
    await pointerAt(box.left + 190, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:10Pris50");
    await pointerAt(box.left + 110, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:00Pris0");
    await userEvent.hover(page.getByRole("button", { name: "før" }));
    await expect.poll(() => tooltipText(host)).toBeNull();
  });

  it("keeps the tooltip dismissed under a resting pointer while the window scrolls", async () => {
    const now = Date.now();
    const { host } = renderThemed(
      <Live
        data={[
          { time: now - 20 * SECOND, value: 0 },
          { time: now - 10 * SECOND, value: 50 },
          { time: now, value: 100 },
        ]}
        paused={false}
      />
    );
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = roleNamed("listbox", "Spotpris nå, datapunkter").getBoundingClientRect();
    await pointerAt(box.left + 200, box.top + 60);
    await expect.poll(() => tooltipText(host)).not.toBeNull();
    // Focus moves by keyboard, so the pointer stays where it rests.
    page.getByRole("button", { name: "før" }).element().focus();
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => tooltipText(host)).toBeNull();
    await nextFrames(10);
    expect(tooltipText(host)).toBeNull();
  });

  it("lists the window's readings newest first in the table", async () => {
    renderThemed(<Live />);
    await userEvent.click(page.getByRole("button", { name: "Vis som tabell" }));
    const table = roleNamed("table", "Spotpris nå, 3 punkter");
    const rows = [...table.querySelectorAll("tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent)
    );
    // Each time cell shows the clock and speaks it with "kl.".
    expect(rows).toEqual([
      ["14:00:20kl. 14:00:20", "100"],
      ["14:00:10kl. 14:00:10", "50"],
      ["14:00:00kl. 14:00:00", "0"],
    ]);
  });
});

describe("live motion", () => {
  /** Three readings that end now, so the window that ends at the clock shows them. */
  function recentReadings(): LiveLineChartPoint[] {
    const now = Date.now();
    return [
      { time: now - 20 * SECOND, value: 0 },
      { time: now - 10 * SECOND, value: 50 },
      { time: now, value: 100 },
    ];
  }

  it("scrolls the window with the clock, every frame, under StrictMode's remount too", async () => {
    const { host } = renderThemed(<Live data={recentReadings()} paused={false} />, { strictMode: true });
    await expect.poll(() => lineD(host)).not.toBeNull();
    const first = lineD(host);
    // A 30 s window over 300 px moves a pixel every 100 ms.
    await expect.poll(() => lineD(host)).not.toBe(first);
  });

  it("badges the latest value, and Root's value wins over the latest reading", async () => {
    const readings = recentReadings();
    const { host, rerender } = renderThemed(
      <Live data={readings} paused={false}>
        <LiveLineChart.Badge />
      </Live>
    );
    // The badge is aria-hidden; its sizer holds the plain text the rolling digits show first.
    const badge = () =>
      host.querySelector('[data-slot="live-line-chart-badge"] [data-slot="chart-axis-sizer"] > *')
        ?.textContent;
    await expect.poll(badge).toBe("100");
    rerender(
      <Live data={readings} value={87} paused={false}>
        <LiveLineChart.Badge />
      </Live>
    );
    await expect.poll(badge).toBe("87");
  });

  it("moves nothing under reduced motion: a new reading redraws once, at rest, every tick opaque, and the ping stops", async () => {
    // At 14:00:22 the domain [−12, 112] over the 124 px plot puts 0 and 100 12 px inside the 16 px
    // fades at the bottom and the top, and 20 32 px from the bottom. The latest time tick, 14:00:20,
    // sits 2 s of the 30 s window from the right edge, inside its 40 px fade on a plot under 600 px.
    await emulateReducedMotion("reduce");
    freezeWallClock(NOON + 22 * SECOND);
    const chart = (data: readonly LiveLineChartPoint[]) => (
      <Live data={data} paused={false}>
        <LiveLineChart.Line curve="linear" />
        <LiveLineChart.LiveDot />
        <LiveLineChart.Grid />
        <LiveLineChart.YAxis />
        <LiveLineChart.XAxis />
      </Live>
    );
    const { host, rerender } = renderThemed(chart(READINGS));
    await expect.poll(() => dotAt(host)).toMatch(/^translate\([\d.]+ 12\)$/u);
    expect(labelsOf(host)).toEqual(["20", "40", "60", "80"]);
    expect(xTickOpacities(host)).toEqual([
      ["14:00:00", 1],
      ["14:00:10", 1],
    ]);
    const lines = staying(host, "chart-grid-line");
    expect(lines.map((line) => Number(getComputedStyle(line).opacity))).toEqual([1, 1, 1, 1]);
    for (const tick of staying(host, "chart-y-tick")) expect(Number(getComputedStyle(tick).opacity)).toBe(1);
    // Each label centers on its grid line.
    const twenty = staying(host, "chart-y-tick")[0]?.getBoundingClientRect();
    const line = lines.find((each) => Math.abs(Number(each.getAttribute("y1")) - 92) < 1e-6);
    expect((twenty?.top ?? 0) + (twenty?.height ?? 0) / 2).toBeCloseTo(
      line?.getBoundingClientRect().top ?? 0,
      1
    );
    // A second on, a running window would have scrolled 10 px.
    const still = lineD(host);
    vi.setSystemTime(NOON + 23 * SECOND);
    await nextFrames(10);
    expect(lineD(host)).toBe(still);
    const ping = host.querySelector('[data-slot="live-line-chart-live-dot"] [data-part="ping"]');
    expect(ping === null ? null : getComputedStyle(ping).animationName).toBe("none");
    // A reading of 50 a moment later keeps the domain [−12, 112], and the dot lands at once.
    rerender(chart([...READINGS, { time: NOON + 20 * SECOND + 1, value: 50 }]));
    expect(dotAt(host)).toMatch(/^translate\([\d.]+ 62\)$/u);
  });

  it("holds the crosshair under a resting pointer while the line scrolls under it", async () => {
    const { host } = renderThemed(<Live data={recentReadings()} paused={false} />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = plotBox(host);
    await pointerAt(box.left + 150, box.top + 60);
    await expect.poll(() => tooltipText(host)).not.toBeNull();
    const first = lineD(host);
    for (let frame = 0; frame < 10; frame += 1) {
      await nextFrames(1);
      expect(crosshairRule(host).getAttribute("transform")).toBe("translate(150 0)");
    }
    // The window scrolled meanwhile: a 30 s window over 300 px moves a pixel every 100 ms.
    await expect.poll(() => lineD(host)).not.toBe(first);
    expect(crosshairRule(host).getAttribute("transform")).toBe("translate(150 0)");
  });

  it("spans the plot with the crosshair's rule in every frame, from the frame a key steps", async () => {
    const { host } = renderThemed(<Live data={recentReadings()} paused={false} />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    await userEvent.click(page.getByRole("button", { name: "før" }));
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{ArrowLeft}");
    for (let frame = 0; frame < 6; frame += 1) {
      const rule = crosshairRule(host).getBoundingClientRect();
      const plot = plotBox(host);
      expect(rule.top).toBeCloseTo(plot.top, 2);
      expect(rule.bottom).toBeCloseTo(plot.bottom, 2);
      await nextFrames(1);
    }
  });

  it("stops the live dot's ping while paused", async () => {
    const ping = (host: HTMLElement) => {
      const ring = host.querySelector('[data-slot="live-line-chart-live-dot"] [data-part="ping"]');
      return ring === null ? null : getComputedStyle(ring).animationName;
    };
    const { host, rerender } = renderThemed(<Live data={recentReadings()} paused={false} />);
    await expect.poll(() => ping(host)).toBe("chart-ping");
    rerender(<Live data={recentReadings()} paused />);
    expect(ping(host)).toBe("none");
  });

  it("fades a value tick and its grid line in at the edge while the domain glides out, opaque at rest", async () => {
    // A reading of 120 keeps d3's step of 20 and sends the domain out to rest at [−14.4, 134.4],
    // where 100 sits (134.4 − 100) / 148.8 × 124 ≈ 28.7 px from the top, past the 16 px fade, so
    // it enters. The glide starts from [−12, 112], where 100 sits 12 px from the top, three
    // quarters of the way into the fade.
    const step = useFakeFramesAt(NOON + 22 * SECOND);
    const { host, rerender } = renderThemed(<Guides paused={false} />);
    await expect.poll(() => labelsOf(host)).toEqual(["20", "40", "60", "80"]);
    // A frame of the running clock, which the reading's glide starts from.
    step(1);
    rerender(<Guides data={[...READINGS, { time: NOON + 21 * SECOND, value: 120 }]} paused={false} />);
    step(1);
    const hundred = staying(host, "chart-y-tick").find((tick) => tick.textContent === "100");
    const top = staying(host, "chart-grid-line").find(
      (line) => Math.abs(Number(line.getAttribute("y1")) - 12) < 1e-6
    );
    expect(Number(hundred?.style.opacity)).toBeCloseTo(0.75, 6);
    expect(Number(top?.style.opacity)).toBeCloseTo(0.75, 6);
    step(60);
    expect(hundred?.style.opacity).toBe("1");
  });

  it("labels the domain a pause holds mid-glide, at that domain's step", async () => {
    // A reading of 1000 sends the domain out to rest at [−120, 1120], whose step of 200 has only 0
    // inside the [−12, 112] the glide starts from, and 0 sits in the bottom fade. A pause in the
    // glide's first frame holds [−12, 112], whose ticks every 20 from 20 to 80 sit 112 − v px down.
    const step = useFakeFramesAt(NOON + 22 * SECOND);
    const risen = [...READINGS, { time: NOON + 21 * SECOND, value: 1000 }];
    const { host, rerender } = renderThemed(<Guides paused={false} />);
    await expect.poll(() => labelsOf(host)).toEqual(["20", "40", "60", "80"]);
    // A frame of the running clock, which the reading's glide starts from.
    step(1);
    rerender(<Guides data={risen} paused={false} />);
    step(1);
    expect(labelsOf(host)).toEqual([]);
    rerender(<Guides data={risen} paused />);
    expect(labelsOf(host)).toEqual(["20", "40", "60", "80"]);
    const plot = plotBox(host).top;
    for (const label of staying(host, "chart-y-tick")) {
      const box = label.getBoundingClientRect();
      expect(box.top + box.height / 2 - plot).toBeCloseTo(112 - Number(label.textContent), 0);
    }
  });

  it("fades a value tick out as the step changes, placing it as the domain moves until it is gone", async () => {
    // 0 to 100 ticks every 20. A reading of 1000, with Root's value at 20, sets the domain to rest
    // at [−120, 1120], whose step is 200, so from the next frame only 0 of the old ticks stays, and
    // 20 and 40 leave. At rest, 20 sits (1120 − 20) / 1240 × 124 = 110 px down, where the live dot
    // draws Root's value.
    const readings = recentReadings();
    const axes = (
      <>
        <LiveLineChart.Line />
        <LiveLineChart.LiveDot variant="default" />
        <LiveLineChart.YAxis />
      </>
    );
    const { host, rerender } = renderThemed(
      <Live data={readings} paused={false}>
        {axes}
      </Live>
    );
    const label = (text: string) =>
      [...host.querySelectorAll<HTMLElement>('[data-slot="chart-y-tick"]')].find(
        (tick) => tick.textContent === text
      );
    await expect.poll(() => label("40")).toBeDefined();
    const twenty = label("20");
    const forty = label("40");
    if (twenty === undefined || forty === undefined) throw new Error("no tick at 20 or 40");
    // Hold each fade where it starts, the moment its tick leaves, so the test reads it mid-way.
    const held = new MutationObserver((records) => {
      for (const { target } of records) {
        if (target instanceof Element && target.hasAttribute("data-leaving")) {
          for (const fade of target.getAnimations()) fade.pause();
        }
      }
    });
    for (const tick of [twenty, forty]) {
      held.observe(tick, { attributes: true, attributeFilter: ["data-leaving"] });
    }
    onTestFinished(() => {
      held.disconnect();
    });
    const latest = Number(readings.at(-1)?.time ?? 0);
    rerender(
      <Live data={[...readings, { time: latest + 1, value: 1000 }]} value={20} paused={false}>
        {axes}
      </Live>
    );
    await expect.poll(() => twenty.hasAttribute("data-leaving")).toBe(true);
    expect(twenty.isConnected).toBe(true);
    const fades = twenty.getAnimations();
    expect(fades.map((fade) => (fade instanceof CSSAnimation ? fade.animationName : null))).toEqual([
      "chart-fade-out",
    ]);
    // While its fade holds, the leaving tick follows the domain to its rest beside the live dot.
    await expect.poll(() => dotAt(host)).toMatch(/^translate\([\d.]+ 110\)$/u);
    await nextFrames(2);
    const center = (element: Element | null | undefined) => {
      const box = element?.getBoundingClientRect();
      return (box?.top ?? Number.NaN) + (box?.height ?? Number.NaN) / 2;
    };
    const dot = host.querySelector('[data-slot="live-line-chart-live-dot"] [data-slot="chart-dot"]');
    expect(center(twenty)).toBeCloseTo(center(dot), 1);
    // A finished fade removes its tick, and so does a canceled one, as reduced motion cancels it.
    for (const fade of fades) fade.finish();
    for (const fade of forty.getAnimations()) fade.cancel();
    await expect.poll(() => twenty.isConnected).toBe(false);
    await expect.poll(() => forty.isConnected).toBe(false);
  });

  it("keeps the crosshair under a resting pointer when the plot narrows", async () => {
    // The pointer rests 150 px into a 300 px plot, then the plot narrows to 200 px with its left
    // edge in place. The rule stays at the pointer, now three quarters of the way across, and the
    // tooltip names the reading nearest it there: 14:00:10, drawn two thirds across, at 133 px.
    const { host, rerender } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = plotBox(host);
    const pointer = box.left + 150;
    await pointerAt(pointer, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:00Pris0");
    rerender(<Live width={200} />);
    await expect.poll(() => plotBox(host).width).toBeLessThan(box.width);
    await nextFrames(1);
    expect(crosshairRule(host).getBoundingClientRect().left).toBeCloseTo(pointer, 1);
    expect(tooltipText(host)).toBe("14:00:10Pris50");
  });

  it("hides the crosshair's ring where no line is drawn, and keeps the rule at the pointer", async () => {
    // The three readings' line starts at 100 px, so at 6 px the pointer is left of it. The rule
    // stands at 6 px, and the tooltip names the nearest reading, 14:00:00.
    const { host } = renderThemed(<Live />);
    await expect.poll(() => lineD(host)).not.toBeNull();
    const box = plotBox(host);
    await pointerAt(box.left + 6, box.top + 60);
    await expect.poll(() => tooltipText(host)).toBe("14:00:00Pris0");
    expect(crosshairRule(host).getAttribute("transform")).toBe("translate(6 0)");
    const ring = host.querySelector('[data-slot="live-line-chart-crosshair"] [data-slot="chart-dot"]');
    expect(ring === null ? null : getComputedStyle(ring).visibility).toBe("hidden");
    expect(getComputedStyle(crosshairRule(host)).visibility).toBe("visible");
  });

  it("holds the badge's column at the widest value it printed until the format changes", async () => {
    const readings = recentReadings();
    const badge = (
      value: number | undefined,
      valueFormat: LiveLineChartRootProps["valueFormat"] = WHOLE,
      data: readonly LiveLineChartPoint[] = readings
    ) => (
      <Live data={data} value={value} paused={false} valueFormat={valueFormat}>
        <LiveLineChart.Badge />
      </Live>
    );
    const { host, rerender } = renderThemed(badge(12_345));
    const sizer = () =>
      host.querySelector('[data-slot="live-line-chart-badge"] [data-slot="chart-axis-sizer"]');
    const width = () => sizer()?.getBoundingClientRect().width ?? Number.NaN;
    await expect.poll(() => sizer()?.textContent).toBe("12\u00a0345");
    const wide = width();
    rerender(badge(7));
    await expect.poll(() => sizer()?.firstElementChild?.textContent).toBe("7");
    expect(width()).toBe(wide);
    // A feed that empties for a while keeps the widest value it printed.
    rerender(badge(undefined, WHOLE, []));
    await expect
      .poll(() => host.querySelector('[data-slot="live-line-chart-badge"] > [data-part="pill"]'))
      .toBeNull();
    rerender(badge(7));
    await expect.poll(() => sizer()?.firstElementChild?.textContent).toBe("7");
    expect(width()).toBe(wide);
    rerender(badge(7, { maximumFractionDigits: 1 }));
    await expect.poll(() => sizer()?.textContent).toBe("7");
    expect(width()).toBeLessThan(wide);
  });

  it("glides the live dot to a new value with motion on, from where it showed", async () => {
    const readings = recentReadings();
    const { host, rerender } = renderThemed(<Live data={readings} paused={false} />);
    await expect.poll(() => dotAt(host)).toBe("translate(300 12)");
    const latest = readings.at(-1);
    rerender(
      <Live data={[...readings, { time: Number(latest?.time ?? 0) + 1, value: 50 }]} paused={false} />
    );
    // The commit that brings the reading draws nothing new: the glide starts in the next frame.
    expect(dotAt(host)).toBe("translate(300 12)");
    await expect.poll(() => dotAt(host)).toBe("translate(300 62)");
  });
});

describe("a chart nested in a live line chart's part", () => {
  /** The nested Root's figure, which the outer live chart's figure holds. */
  function nestedFigure(host: HTMLElement): HTMLElement {
    const figure = host.querySelector<HTMLElement>('[data-slot="chart"] [data-slot="chart"]');
    if (figure === null) throw new Error("no nested Root");
    return figure;
  }

  it("lays a nested Chart's value ticks out by value, untouched by the live chart's own rules", async () => {
    // The nested bars run 1 to 3, so its value axis holds several ticks. A higher value sits
    // higher, so ordered by value the ticks' tops fall, and no two share one.
    const { host } = renderThemed(
      <Live>
        <LiveLineChart.Headline>
          <div style={{ width: 240 }}>
            <Chart.Root
              data={[1, 2, 3].map((v, index) => ({ name: String(index), v }))}
              config={{ v: { label: "Forbruk", color: "chart-1" } }}
              xKey="name"
              data-intro="none"
              aria-label="Indre">
              <Chart.Bar dataKey="v" />
              <Chart.YAxis />
            </Chart.Root>
          </div>
        </LiveLineChart.Headline>
        <LiveLineChart.Line />
        <LiveLineChart.YAxis />
      </Live>
    );
    const ticks = () =>
      [...nestedFigure(host).querySelectorAll('[data-slot="chart-y-tick"]')].map((tick) => ({
        value: Number(tick.textContent.replace("\u2212", "-").replace(",", ".")),
        top: tick.getBoundingClientRect().top,
      }));
    await expect.poll(() => ticks().length).toBeGreaterThan(2);
    const tops = ticks()
      .toSorted((a, b) => a.value - b.value)
      .map(({ top }) => top);
    for (const [index, top] of tops.entries()) {
      if (index > 0) expect(top).toBeLessThan(tops[index - 1] ?? Number.NaN);
    }
  });

  it("keeps a running nested live chart's ping while the outer one is paused", async () => {
    const now = Date.now();
    const { host } = renderThemed(
      <Live>
        <LiveLineChart.Headline>
          <LiveLineChart.Root
            data={[
              { time: now - 10 * SECOND, value: 0 },
              { time: now, value: 50 },
            ]}
            aria-label="Indre">
            <LiveLineChart.LiveDot />
          </LiveLineChart.Root>
        </LiveLineChart.Headline>
        <LiveLineChart.LiveDot />
      </Live>
    );
    await expect.poll(() => nestedFigure(host).querySelector('[data-part="ping"]')).not.toBeNull();
    const inner = nestedFigure(host).querySelector('[data-part="ping"]');
    const outer = [...host.querySelectorAll('[data-part="ping"]')].find((ping) => ping !== inner);
    expect(inner === null ? null : getComputedStyle(inner).animationName).toBe("chart-ping");
    expect(outer === undefined ? null : getComputedStyle(outer).animationName).toBe("none");
  });
});
