// The chart tooltip's roof and glide, with motion on, in Chromium. The oracle for "covers no mark"
// is the drawn marks themselves, which test/chart/tooltip-glide reads from the DOM.
import { useLayoutEffect, useState } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { glideLanded, label, pointerAt, popup, surfaceBox } from "../../../test/chart/marks";
import {
  MONTHS,
  REVENUE,
  DAYS,
  WIDE,
  barChart,
  dispatchSlotMove,
  dotFrame,
  hoverSlot,
  lineChart,
  positioner,
  sweepGlides,
  watchDots,
  watchFrames,
  wideChart,
} from "../../../test/chart/tooltip-glide";
import type { DotFrame } from "../../../test/chart/tooltip-glide";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartCurve, ChartSeriesConfig } from "./chart-types";
import "./chart.css";

beforeEach(async () => {
  await page.viewport(1024, 768);
});

afterEach(async () => {
  await page.viewport(1024, 768);
});

describe("a pointer sweep with motion on", () => {
  it.each([
    ["two grouped bar series", barChart, MONTHS, "band"],
    ["two 30-point lines", lineChart, DAYS.map(({ day }) => day), "point"],
    ["columns wider than the popup", wideChart, WIDE, "band"],
  ] as const)(
    "never lets the popup cover a mark of %s, in any frame, both ways",
    { timeout: 90_000 },
    async (_, chart, slots, scale) => {
      const { host } = renderThemed(chart());
      await nextFrames(2);
      const watch = watchFrames(host);
      const order = [...slots.keys(), ...[...slots.keys()].toReversed()];
      for (const slot of order) {
        await hoverSlot(host, slot, slots.length, scale);
        // The glide runs 200 ms, about 12 frames at 60 Hz.
        await nextFrames(16);
        expect(label()).toBe(slots[slot]);
      }
      watch.stop();
      expect(watch.lefts.length).toBeGreaterThan(order.length * 8);
      expect(watch.covered).toEqual([]);
    }
  );
});

describe("the popup's place along x", () => {
  it("centres on the slot, and the chart Root's box holds it at the last slot", async () => {
    const { host } = renderThemed(barChart());
    // DOM audit: the Root is the figure that carries the chart's slot.
    const root = host.querySelector('[data-slot="chart"]')?.getBoundingClientRect() ?? new DOMRect();
    const box = surfaceBox(host);
    await hoverSlot(host, 2, 6, "band");
    await nextFrames(20);
    await glideLanded();
    const middle = positioner()?.getBoundingClientRect() ?? new DOMRect();
    expect(
      Math.abs((middle.left + middle.right) / 2 - (box.left + (box.width * 2.5) / 6))
    ).toBeLessThanOrEqual(1);
    await hoverSlot(host, 5, 6, "band");
    await nextFrames(20);
    await glideLanded();
    // Centred on Jun, the popup would pass the Root's right edge, so it ends on that edge.
    const last = positioner()?.getBoundingClientRect() ?? new DOMRect();
    expect(box.left + (box.width * 5.5) / 6 + last.width / 2).toBeGreaterThan(root.right + 1);
    expect(Math.abs(last.right - root.right)).toBeLessThanOrEqual(1);
  });
});

describe("the glide", () => {
  /** The popup's resting left edge once it has landed. */
  async function landedLeft(): Promise<number> {
    await nextFrames(20);
    await glideLanded();
    return positioner()?.getBoundingClientRect().left ?? Number.NaN;
  }

  it("passes through places between two slots on a pointer step", async () => {
    const { host } = renderThemed(barChart());
    await hoverSlot(host, 1, 6, "band");
    const from = await landedLeft();
    const watch = watchFrames(host);
    await hoverSlot(host, 2, 6, "band");
    const to = await landedLeft();
    watch.stop();
    expect(to - from).toBeGreaterThan(40);
    // At least one frame shows the popup more than a pixel from both ends.
    expect(watch.lefts.some((left) => left > from + 1 && left < to - 1)).toBe(true);
  });

  it("passes through places between two slots on a key step", async () => {
    const { host } = renderThemed(barChart());
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Home}");
    expect(label()).toBe("Jan");
    const from = await landedLeft();
    const watch = watchFrames(host);
    await userEvent.keyboard("{ArrowRight}");
    const to = await landedLeft();
    watch.stop();
    expect(label()).toBe("Feb");
    expect(to - from).toBeGreaterThan(40);
    expect(watch.lefts.some((left) => left > from + 1 && left < to - 1)).toBe(true);
  });

  it("does not glide when the popup opens, even far from where it last closed", async () => {
    const { host } = renderThemed(barChart());
    await hoverSlot(host, 0, 6, "band");
    await landedLeft();
    await userEvent.hover(document.body, { position: { x: 2, y: 2 }, force: true });
    await expect.poll(() => popup()).toBeNull();
    await nextFrames(20);
    const watch = watchFrames(host);
    await hoverSlot(host, 5, 6, "band");
    const to = await landedLeft();
    watch.stop();
    expect(watch.lefts.length).toBeGreaterThan(0);
    expect(
      watch.lefts.every((left) => Math.abs(left - to) <= 0.5),
      JSON.stringify(watch.lefts)
    ).toBe(true);
  });

  it("moves at once on a data update", async () => {
    // Feb, Mar and Apr rise to 24,000, under the 25,000 the axis already ends at, so the axis
    // keeps its scale and the roof over Mar's popup rises from Apr's 18,800.
    const rows = (raised: boolean) =>
      MONTHS.map((month, index) => ({
        month,
        revenue: raised && index >= 1 && index <= 3 ? 24000 : REVENUE[index],
      }));
    const view = (raised: boolean) => (
      <div style={{ padding: "160px 24px 24px", width: 640, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={rows(raised)}
            config={{ revenue: { label: "Revenue", color: "chart-1" } }}
            xKey="month"
            data-intro="none"
            aria-label="Revenue and profit">
            <Chart.Bar dataKey="revenue" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const { host, rerender } = renderThemed(view(false));
    await hoverSlot(host, 2, 6, "band");
    await nextFrames(20);
    const before = popup()?.getBoundingClientRect().top ?? Number.NaN;
    const tops: number[] = [];
    let running = true;
    const record = () => {
      if (!running) return;
      const top = popup()?.getBoundingClientRect().top;
      if (top !== undefined) tops.push(top);
      requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
    rerender(view(true));
    // The bars tween for --chart-update, 480 ms, and the popup measures them again once they land.
    await nextFrames(60);
    running = false;
    const after = popup()?.getBoundingClientRect().top ?? Number.NaN;
    expect(before - after).toBeGreaterThan(30);
    // Every frame shows the popup at one of its resting places, never between them.
    const distinct = [...new Set(tops.map((top) => Math.round(top)))];
    expect(distinct.length, JSON.stringify(distinct)).toBeLessThanOrEqual(3);
    expect(Math.round(tops.at(-1) ?? Number.NaN)).toBe(Math.round(after));
  });
});

describe("scrolling while the popup shows", () => {
  it.each(["the page", "a scroll container"] as const)(
    "keeps the popup on its anchor when %s scrolls",
    async (scroller) => {
      await page.viewport(800, 600);
      const inner = scroller === "a scroll container";
      const { host } = renderThemed(
        <div data-testid="scroller" style={inner ? { height: 500, overflowY: "auto" } : undefined}>
          <div style={{ padding: "200px 24px 900px", width: 640, boxSizing: "border-box" }}>
            <LocaleProvider locale="en-US">
              <Chart.Root
                data={MONTHS.map((month, index) => ({ month, revenue: REVENUE[index] }))}
                config={{ revenue: { label: "Revenue", color: "chart-1" } }}
                xKey="month"
                data-intro="none"
                aria-label="Revenue">
                <Chart.Bar dataKey="revenue" />
                <Chart.Tooltip />
              </Chart.Root>
            </LocaleProvider>
          </div>
        </div>
      );
      // The pointer stays inside the plot when the scroll carries the plot 60 px up under it.
      await hoverSlot(host, 1, 6, "band", 0.4);
      await nextFrames(20);
      // DOM audit: the scroll container has no role, so its test id finds it.
      const element = inner ? host.querySelector<HTMLElement>('[data-testid="scroller"]') : null;
      const plotBefore = surfaceBox(host);
      // A step starts a glide, and the scroll lands while it runs.
      await hoverSlot(host, 2, 6, "band", 0.4);
      if (element === null) window.scrollBy(0, 60);
      else element.scrollTop += 60;
      const offsets: number[] = [];
      for (let frame = 0; frame < 24; frame += 1) {
        await nextFrames(1);
        const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
        offsets.push(shown.top - surfaceBox(host).top);
      }
      expect(surfaceBox(host).top).toBeCloseTo(plotBefore.top - 60, 0);
      expect(label()).toBe("Mar");
      // From the second frame, once Base UI has answered the scroll, the popup holds its resting
      // place over the plot: it neither trails the plot nor finishes the glide.
      const rest = offsets.at(-1) ?? Number.NaN;
      const off = offsets.slice(1).map((offset) => Math.abs(offset - rest));
      expect(Math.max(...off), JSON.stringify(offsets)).toBeLessThanOrEqual(0.5);
    }
  );
});

describe("a pointer moving straight up from the active slot", () => {
  it("reaches the popup over a bar that fills the plot, with the slot unchanged", async () => {
    // k1's bar reaches the plot's top, so the popup rests 8 px above the plot, outside the surface.
    const { host } = renderThemed(wideChart());
    const box = surfaceBox(host);
    const x = box.left + (box.width * 1.5) / WIDE.length;
    await hoverSlot(host, 1, WIDE.length, "band");
    await nextFrames(20);
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(shown.bottom).toBeLessThan(box.top - 4);
    for (let y = box.top + 10; y > shown.bottom - 6; y -= 2) {
      await pointerAt(x, y);
      await nextFrames(2);
      expect(label(), `at y ${String(y)}`).toBe("k1");
    }
  });
});

describe("the popup's roof under its final place", () => {
  it("rests over the span the viewport holds it to, not the span centred on the slot", async () => {
    // A 300 px chart at the page's left edge and a 320 px popup. Centred on the first slot it would
    // start left of the viewport, so it shows from the viewport's 8 px gap, over the tall fourth bar.
    await page.viewport(1024, 768);
    const { host } = renderThemed(
      <div style={{ padding: "200px 0 24px 8px", width: 308, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[1, 1, 1, 4].map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Short and tall">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip style={{ width: 320, boxSizing: "border-box" }} />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await hoverSlot(host, 0, 4, "band");
    await nextFrames(20);
    expect(label()).toBe("k0");
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    // DOM audit: bars are aria-hidden plot output, in slot order.
    const tall =
      host.querySelectorAll('[data-slot="chart-bar"]')[3]?.getBoundingClientRect() ?? new DOMRect();
    expect(shown.right).toBeGreaterThan(tall.left);
    expect(shown.bottom).toBeLessThanOrEqual(tall.top - 7.5);
  });

  it("rests over a line that a transform moves, where the line draws", async () => {
    // A flat line at 50 on 0 to 100 sits at the middle of the 200 px plot, and the line's own
    // style moves it 32 px up, so its 2 px stroke tops out at 100 − 32 − 1 = 67 px under the plot's
    // top, and the popup's bottom 8 px above that.
    const { host } = renderThemed(
      <div style={{ padding: "160px 24px 24px", width: 640, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[0, 1, 2, 3].map((index) => ({ name: `k${String(index)}`, v: 50 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            yInclude={[0, 100]}
            data-intro="none"
            aria-label="Moved line">
            <Chart.Line dataKey="v" curve="linear" style={{ transform: "translateY(-32px)" }} />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    const box = surfaceBox(host);
    expect(box.height).toBe(200);
    await hoverSlot(host, 1, 4, "point");
    await nextFrames(20);
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(shown.bottom - (box.top + 67 - 8))).toBeLessThanOrEqual(1);
  });
});

/** A natural line over four points on 0 to 100, which a data update moves. */
function NaturalLine({ values, width }: { readonly values: readonly number[]; readonly width: number }) {
  return (
    <div style={{ padding: "200px 24px 24px", width: 520, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={values.map((v, index) => ({ name: `k${String(index)}`, v }))}
          config={{ v: { label: "V", color: "chart-1" } }}
          xKey="name"
          xScale="point"
          yInclude={[0, 100]}
          data-intro="none"
          aria-label="Natural line">
          <Chart.Line dataKey="v" curve="natural" />
          <Chart.Tooltip style={{ width, boxSizing: "border-box" }} />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

describe("a data update while the popup shows", () => {
  it.each([
    ["[0, 20, 20, 0] to [0, 100, 100, 0] under a 240 px popup", [0, 20, 20, 0], [0, 100, 100, 0], 240],
    ["[0, 0, 0, 0] to [0, 75, 75, 0] under a 280 px popup", [0, 0, 0, 0], [0, 75, 75, 0], 280],
  ] as const)(
    "keeps the popup off a natural curve that rises %s, in every frame",
    async (_, from, to, width) => {
      // The curve passes above its readings between the two middle points, so only the curve the
      // tween lands on, overshoot and stroke included, bounds where it reaches.
      const { host, rerender } = renderThemed(<NaturalLine values={from} width={width} />);
      await hoverSlot(host, 0, 4, "point");
      await nextFrames(20);
      expect(label()).toBe("k0");
      const watch = watchFrames(host, "moving");
      rerender(<NaturalLine values={to} width={width} />);
      // The tween runs --chart-update, 480 ms.
      await nextFrames(45);
      watch.stop();
      expect(watch.tops.length).toBeGreaterThan(20);
      expect(watch.covered).toEqual([]);
    }
  );
});

describe("a step whose raised path would leave the viewport", () => {
  it("jumps when the popup overlays the plot because no side holds it", async () => {
    // A 320 × 225 viewport and a 280 × 160 popup: neither above, below nor beside the column holds
    // it, so it overlays the plot at the viewport's top gap, and a step moves it there at once,
    // since any path over k1's bar, which fills the plot, would leave the viewport.
    await page.viewport(320, 225);
    const { host } = renderThemed(
      <div style={{ padding: "8px", width: "100%", boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[2, 4, 1, 3].map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            style={{ "--chart-plot-height": "180px" }}
            data-intro="none"
            aria-label="Crowded">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip style={{ width: 280, height: 160, boxSizing: "border-box" }} />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await hoverSlot(host, 0, 4, "band");
    await nextFrames(20);
    const from = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    const watch = watchFrames(host);
    // The Root's box holds the 280 px popup at its left edge over k0 and at its right edge over k3.
    await hoverSlot(host, 3, 4, "band");
    await nextFrames(20);
    watch.stop();
    expect(label()).toBe("k3");
    const to = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    expect(to - from).toBeGreaterThan(10);
    expect(Math.min(...watch.tops), JSON.stringify(watch.tops)).toBeGreaterThanOrEqual(7);
    // Every frame shows the popup at one of its two places, never between them.
    expect(
      watch.lefts.every((left) => Math.abs(left - from) <= 0.5 || Math.abs(left - to) <= 0.5),
      JSON.stringify({ from, to, lefts: watch.lefts })
    ).toBe(true);
  });

  it("jumps between the outer slots of a line whose peak sits near the page's top", async () => {
    // Readings 50, 100 and 0. Each outer slot leaves the popup room above the line, but the sweep
    // from one to the other passes the peak at the plot's top, 40 px under the page's top, where
    // the raised popup would leave the viewport.
    const { host } = renderThemed(
      <div style={{ padding: "40px 24px 24px", width: 640, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={[50, 100, 0].map((v, index) => ({ name: `k${String(index)}`, v }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            xScale="point"
            yInclude={[0, 100]}
            data-intro="none"
            aria-label="Peak">
            <Chart.Line dataKey="v" curve="linear" />
            <Chart.Tooltip />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await hoverSlot(host, 0, 3, "point");
    await nextFrames(20);
    const watch = watchFrames(host);
    await hoverSlot(host, 2, 3, "point");
    await nextFrames(20);
    await hoverSlot(host, 0, 3, "point");
    await nextFrames(20);
    watch.stop();
    expect(label()).toBe("k0");
    expect(Math.min(...watch.tops), JSON.stringify(watch.tops)).toBeGreaterThanOrEqual(7);
    expect(watch.covered).toEqual([]);
  });
});

describe("a step onto a label that wraps", () => {
  it("grows the popup upward from its old bottom edge, so it never covers the old slot's bar", async () => {
    // A 128 px popup. The second category's name wraps over several lines, so the popup grows
    // taller on the step, and every frame must keep it off the bars.
    const names = ["Q1", "The third quarter of the fiscal year, after the summer", "Q3"];
    const { host } = renderThemed(
      <div style={{ padding: "260px 24px 24px", width: 640, boxSizing: "border-box" }}>
        <LocaleProvider locale="en-US">
          <Chart.Root
            data={names.map((name) => ({ name, v: 3 }))}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            aria-label="Quarters">
            <Chart.Bar dataKey="v" />
            <Chart.Tooltip style={{ width: 128, boxSizing: "border-box" }} />
          </Chart.Root>
        </LocaleProvider>
      </div>
    );
    await hoverSlot(host, 0, 3, "band");
    await nextFrames(20);
    const short = popup()?.getBoundingClientRect().height ?? 0;
    const watch = watchFrames(host);
    await hoverSlot(host, 1, 3, "band");
    await nextFrames(20);
    watch.stop();
    expect(label()).toBe(names[1]);
    expect(popup()?.getBoundingClientRect().height ?? 0).toBeGreaterThan(short + 30);
    expect(watch.lefts.length).toBeGreaterThan(5);
    expect(watch.covered).toEqual([]);
  });
});

/**
 * One row of a scene: its category and its reading, null for a missing one, and the reading of a
 * second line when the scene draws one.
 */
type Row = { readonly name: string; readonly v: number | null; readonly w?: number };

/** Rows named k{first} onward with their readings. */
function named(values: readonly number[], first = 0): Row[] {
  return values.map((v, index) => ({ name: `k${String(first + index)}`, v }));
}

/** A chart of bars or a line over rows, on a fixed 0 to 100 axis, which a test re-renders. */
function Scene({
  rows,
  kind,
  curve = "linear",
  markStyle,
  popupWidth,
  glide,
  stroke,
  plotHeight,
  missing,
  glowStroke,
  variant,
  plotWidth = 600,
  padding = "200px 24px 24px",
  second = false,
  barDot = false,
  bandGap,
}: {
  readonly rows: readonly Row[];
  readonly kind: "bars" | "line";
  readonly curve?: ChartCurve;
  readonly markStyle?: { readonly transform: string };
  readonly popupWidth?: number;
  readonly glide?: string;
  /** Root's `--chart-stroke`. */
  readonly stroke?: string;
  /** Root's `--chart-plot-height`. */
  readonly plotHeight?: string;
  /** How the line crosses a missing reading. */
  readonly missing?: "connect";
  /** Draws the line inside a Glow that sets this `--chart-stroke`. */
  readonly glowStroke?: string;
  /** The line's look. */
  readonly variant?: "default" | "dashed";
  /** The plot's width, which the 24 px gutters frame. */
  readonly plotWidth?: number;
  readonly padding?: string;
  /** Draws a second line, `w`, with its own active dot. */
  readonly second?: boolean;
  /** Draws an active dot on the bars, which rides their tops. */
  readonly barDot?: boolean;
  /** Root's `--chart-band-gap`, the percentage of each band left empty. */
  readonly bandGap?: string;
}) {
  const series: ChartSeriesConfig =
    missing === undefined ? { label: "V", color: "chart-1" } : { label: "V", color: "chart-1", missing };
  const rootStyle: { [name: `--chart-${string}`]: string } = {};
  if (glide !== undefined) rootStyle["--chart-glide"] = glide;
  if (stroke !== undefined) rootStyle["--chart-stroke"] = stroke;
  if (plotHeight !== undefined) rootStyle["--chart-plot-height"] = plotHeight;
  if (bandGap !== undefined) rootStyle["--chart-band-gap"] = bandGap;
  return (
    <div style={{ padding, width: plotWidth + 48, boxSizing: "border-box" }}>
      <LocaleProvider locale="en-US">
        <Chart.Root
          data={rows}
          config={second ? { v: series, w: { label: "W", color: "chart-2" } } : { v: series }}
          xKey="name"
          xScale={kind === "line" ? "point" : "band"}
          yInclude={[0, 100]}
          data-intro="none"
          style={rootStyle}
          aria-label="Scene">
          {kind === "bars" ? (
            <>
              <Chart.Bar dataKey="v" style={markStyle} />
              {barDot ? <Chart.ActiveDot dataKey="v" /> : null}
            </>
          ) : glowStroke === undefined ? (
            <>
              <Chart.Line dataKey="v" curve={curve} style={markStyle} variant={variant} />
              {second ? <Chart.Line dataKey="w" curve={curve} style={markStyle} /> : null}
              <Chart.ActiveDot dataKey="v" />
              {second ? <Chart.ActiveDot dataKey="w" /> : null}
            </>
          ) : (
            <Chart.Glow style={{ "--chart-stroke": glowStroke }}>
              <Chart.Line dataKey="v" curve={curve} style={markStyle} />
            </Chart.Glow>
          )}
          <Chart.Tooltip
            style={popupWidth === undefined ? undefined : { width: popupWidth, boxSizing: "border-box" }}
          />
        </Chart.Root>
      </LocaleProvider>
    </div>
  );
}

describe("the path form's columns", () => {
  it("hold the popup above them where a transform moves them", async () => {
    // 101 bars at 50 on 0 to 100 draw as paths. Their style moves them 32 px up, so their tops sit
    // at 100 − 32 = 68 px under the plot's top, and the popup rests 8 px above that.
    const { host } = renderThemed(
      <Scene
        rows={named(Array.from({ length: 101 }, () => 50))}
        kind="bars"
        markStyle={{ transform: "translateY(-32px)" }}
      />
    );
    // DOM audit: the path form draws each series' columns as one path.
    expect(host.querySelector('[data-slot="chart-bar-path"]')).not.toBeNull();
    const box = surfaceBox(host);
    await hoverSlot(host, 50, 101, "band");
    await nextFrames(20);
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(shown.bottom - (box.top + 68 - 8))).toBeLessThanOrEqual(1);
  });
});

describe("marks that draw something new while the popup shows", () => {
  it("place the popup again, off a curve switched from linear to natural, in every frame", async () => {
    const rows = named([0, 75, 75, 0]);
    const { host, rerender } = renderThemed(<Scene rows={rows} kind="line" popupWidth={280} />);
    await hoverSlot(host, 0, 4, "point");
    await nextFrames(20);
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={rows} kind="line" curve="natural" popupWidth={280} />);
    await nextFrames(20);
    watch.stop();
    expect(label()).toBe("k0");
    expect(watch.covered).toEqual([]);
  });

  it("place the popup again over a line that a new transform moves", async () => {
    // A flat line at 50 moves 32 px up, so its 2 px stroke tops out at 67 px under the plot's top.
    const rows = named([50, 50, 50, 50]);
    const { host, rerender } = renderThemed(<Scene rows={rows} kind="line" />);
    const box = surfaceBox(host);
    await hoverSlot(host, 1, 4, "point");
    await nextFrames(20);
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={rows} kind="line" markStyle={{ transform: "translateY(-32px)" }} />);
    await nextFrames(20);
    watch.stop();
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(shown.bottom - (box.top + 67 - 8))).toBeLessThanOrEqual(1);
    expect(watch.covered).toEqual([]);
  });
});

describe("styling that changes the marks while the popup shows", () => {
  it("places the popup again when Root's stroke grows from 2 px to 40 px", async () => {
    // A flat line at 50 sits at the middle of the 200 px plot. A 40 px stroke reaches 20 px above
    // it, to 80 px under the plot's top, and the popup rests 8 px above that.
    const rows = named([50, 50, 50, 50]);
    const { host, rerender } = renderThemed(<Scene rows={rows} kind="line" stroke="2px" />);
    const box = surfaceBox(host);
    await hoverSlot(host, 1, 4, "point");
    await nextFrames(20);
    rerender(<Scene rows={rows} kind="line" stroke="40px" />);
    await nextFrames(20);
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(shown.bottom - (box.top + 80 - 8))).toBeLessThanOrEqual(1);
  });

  it("places the popup again when a transform moves the line in the middle of a data update", async () => {
    // A flat line rises from 20 to 50. About 90 ms into the tween its style moves it 48 px up, with
    // the data unchanged, so only the change to the line's own style can place the popup again.
    const rising = named([50, 50, 50, 50]);
    const { host, rerender } = renderThemed(<Scene rows={named([20, 20, 20, 20])} kind="line" />);
    await hoverSlot(host, 1, 4, "point");
    await nextFrames(20);
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={rising} kind="line" />);
    await nextFrames(5);
    rerender(<Scene rows={rising} kind="line" markStyle={{ transform: "translateY(-48px)" }} />);
    await nextFrames(40);
    watch.stop();
    expect(watch.covered).toEqual([]);
  });
});

describe("a monotone curve in the middle of a data update", () => {
  it("never meets the popup, though it passes above both its old and its new shape", async () => {
    // A 600 × 600 plot on 0 to 100 and a 128 px popup on the fourth point. Between [44, 23, 55, 0]
    // and [33.5, 91, 58, 19.5] the monotone curve's slopes change apart from its points, so a
    // frame's curve can rise above both end shapes, though never above a segment's two vertices.
    const before = named([44, 23, 55, 0]);
    const after = named([33.5, 91, 58, 19.5]);
    const props = {
      kind: "line",
      curve: "monotone",
      popupWidth: 128,
      plotHeight: "600px",
      padding: "120px 24px 24px",
    } as const;
    const { host, rerender } = renderThemed(<Scene rows={before} {...props} />);
    await hoverSlot(host, 3, 4, "point");
    await nextFrames(20);
    expect(label()).toBe("k3");
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={after} {...props} />);
    await nextFrames(45);
    watch.stop();
    expect(watch.tops.length).toBeGreaterThan(20);
    expect(watch.covered).toEqual([]);
  });
});

describe("a data update whose route the loop paints apart from both its ends", () => {
  /** The props of a 600 × 600 point plot on 0 to 100 with a 128 px popup. */
  const tall = { kind: "line", popupWidth: 128, plotHeight: "600px", padding: "120px 24px 24px" } as const;

  it.each([
    [
      "a natural curve that slides [0, 44, 67, 76] on k0 to k3 to [78, 61, 18, 15] on k1 to k4",
      named([0, 44, 67, 76]),
      named([78, 61, 18, 15], 1),
    ],
    [
      "a natural curve that slides seven zeros on k0 to k6 to seven 80s on k1 to k7",
      named([0, 0, 0, 0, 0, 0, 0]),
      named([80, 80, 80, 80, 80, 80, 80], 1),
    ],
  ])("keeps the popup on k1 off %s, in every frame", async (_, before, after) => {
    // While the window slides, the leaving vertex still bends the curve the loop paints, so the
    // frames rise past both the old curve and the new one.
    const { host, rerender } = renderThemed(<Scene rows={before} curve="natural" {...tall} />);
    await hoverSlot(host, 1, before.length, "point");
    await nextFrames(20);
    expect(label()).toBe("k1");
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={after} curve="natural" {...tall} />);
    await nextFrames(45);
    watch.stop();
    expect(watch.tops.length).toBeGreaterThan(20);
    expect(watch.covered).toEqual([]);
  });

  it("keeps the popup on slot 6 off a monotone bridge across missing readings, in every frame", async () => {
    // Twelve slots with readings at 0, 1, 2 and 11 only. The line bridges slots 3 to 10, and the
    // bridge from slot 2 to slot 11 passes under the popup on slot 6.
    const rows = (values: readonly number[]) =>
      Array.from({ length: 12 }, (_, index) => ({
        name: `k${String(index)}`,
        v: [0, 1, 2].includes(index) ? (values[index] ?? 0) : index === 11 ? (values[3] ?? 0) : null,
      }));
    const props = { ...tall, curve: "monotone", missing: "connect" } as const;
    const { host, rerender } = renderThemed(<Scene rows={rows([53, 84, 73, 10])} {...props} />);
    await hoverSlot(host, 6, 12, "point");
    await nextFrames(20);
    expect(label()).toBe("k6");
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={rows([87, 4, 65, 6])} {...props} />);
    await nextFrames(45);
    watch.stop();
    expect(watch.covered).toEqual([]);
  });
});

describe("a reader step that moves the popup nowhere", () => {
  it("spends its glide, so a later change of size moves the popup at once", async () => {
    // A 640 px popup is wider than the 600 px chart, so it centres on its slot, and the viewport's
    // edge holds it at the same place over the first two slots. It then shrinks to 128 px.
    const rows = named([30, 40, 30, 40]);
    const { host, rerender } = renderThemed(<Scene rows={rows} kind="bars" popupWidth={640} />);
    await hoverSlot(host, 0, 4, "band");
    await nextFrames(20);
    const wide = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    await hoverSlot(host, 1, 4, "band");
    await nextFrames(20);
    expect(label()).toBe("k1");
    expect(positioner()?.getBoundingClientRect().left).toBeCloseTo(wide, 0);
    const watch = watchFrames(host);
    rerender(<Scene rows={rows} kind="bars" popupWidth={128} />);
    await nextFrames(30);
    watch.stop();
    const narrow = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    expect(narrow - wide).toBeGreaterThan(50);
    expect(
      watch.lefts.every((left) => Math.abs(left - wide) <= 0.5 || Math.abs(left - narrow) <= 0.5),
      JSON.stringify({ wide, narrow, lefts: watch.lefts })
    ).toBe(true);
  });
});

describe("a wrapper inside Root that styles the marks", () => {
  it("places the popup again when Glow's stroke grows from 2 px to 40 px", async () => {
    // A flat line at 50 inside Glow. A 40 px stroke reaches 20 px above the plot's middle, to 80 px
    // under its top, and the popup rests 8 px above that.
    const rows = named([50, 50, 50, 50]);
    const { host, rerender } = renderThemed(<Scene rows={rows} kind="line" glowStroke="2px" />);
    const box = surfaceBox(host);
    await hoverSlot(host, 1, 4, "point");
    await nextFrames(20);
    rerender(<Scene rows={rows} kind="line" glowStroke="40px" />);
    await nextFrames(20);
    const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
    expect(Math.abs(shown.bottom - (box.top + 80 - 8))).toBeLessThanOrEqual(1);
  });
});

describe("a mark attribute that a stylesheet strokes apart", () => {
  it("places the popup again when the line's variant switches to one drawn 40 px wide", async () => {
    // A consumer's stylesheet draws the dashed variant 40 px wide. A flat line at 50 then reaches
    // 20 px above the plot's middle, to 80 px under its top, and the popup rests 8 px above that.
    const sheet = document.createElement("style");
    sheet.textContent =
      '[data-slot="chart-line-series"][data-variant="dashed"] [data-slot="chart-line"] { stroke-width: 40px; }';
    document.head.append(sheet);
    try {
      const rows = named([50, 50, 50, 50]);
      const { host, rerender } = renderThemed(<Scene rows={rows} kind="line" variant="default" />);
      const box = surfaceBox(host);
      await hoverSlot(host, 1, 4, "point");
      await nextFrames(20);
      rerender(<Scene rows={rows} kind="line" variant="dashed" />);
      await nextFrames(20);
      const shown = popup()?.getBoundingClientRect() ?? new DOMRect();
      expect(Math.abs(shown.bottom - (box.top + 80 - 8))).toBeLessThanOrEqual(1);
    } finally {
      sheet.remove();
    }
  });
});

describe("a data update that slides the marks along x", () => {
  it.each([
    ["with the glide", undefined],
    ["without the glide", "0ms"],
  ])("keeps the popup off a peak that slides under it, %s", async (_, glide) => {
    // Seven points, only k4 at 100. The update shows k3 to k9, so k4's peak slides from the fifth
    // place to the second, past the popup on k5, which Root keeps active.
    const before = named([0, 0, 0, 0, 100, 0, 0]);
    const after = named([0, 100, 0, 0, 0, 0, 0], 3);
    const { host, rerender } = renderThemed(<Scene rows={before} kind="line" glide={glide} />);
    await hoverSlot(host, 5, 7, "point");
    await nextFrames(20);
    expect(label()).toBe("k5");
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={after} kind="line" glide={glide} />);
    await nextFrames(45);
    watch.stop();
    expect(label()).toBe("k5");
    expect(watch.tops.length).toBeGreaterThan(20);
    expect(watch.covered).toEqual([]);
  });

  it.each([
    ["with the glide", undefined],
    ["without the glide", "0ms"],
  ])("keeps a 128 px popup on k4 off k3's peak as k0 to k5 slide to k3 to k8, %s", async (_, glide) => {
    const before = named([0, 0, 0, 100, 0, 0]);
    const after = named([100, 0, 0, 0, 0, 0], 3);
    const { host, rerender } = renderThemed(
      <Scene rows={before} kind="line" popupWidth={128} glide={glide} />
    );
    await hoverSlot(host, 4, 6, "point");
    await nextFrames(20);
    expect(label()).toBe("k4");
    const watch = watchFrames(host, "moving");
    rerender(<Scene rows={after} kind="line" popupWidth={128} glide={glide} />);
    await nextFrames(45);
    watch.stop();
    expect(watch.covered).toEqual([]);
  });

  it.each([
    [
      "a bar at 100 slides from k3 under an 800 px plot's popup on k4",
      800,
      named([0, 0, 0, 100, 0, 0]),
      named([100, 0, 0, 0, 0, 0], 3),
      4,
    ],
    [
      "a bar at 100 slides from k4 under a 600 px plot's popup on k6",
      600,
      named([0, 0, 0, 0, 100, 0, 0]),
      named([100, 0, 0, 0, 0, 0, 0], 4),
      6,
    ],
  ])("keeps the popup off %s, in every frame", async (_, plotWidth, before, after, slot) => {
    // The window slides, so the tall bar moves along x, from where it shows to where it lands,
    // past the popup's span in between.
    const props = { kind: "bars", popupWidth: 128, plotWidth } as const;
    const { host, rerender } = renderThemed(<Scene rows={before} {...props} />);
    await hoverSlot(host, slot, before.length, "band");
    await nextFrames(20);
    expect(label()).toBe(`k${String(slot)}`);
    const watch = watchFrames(host);
    rerender(<Scene rows={after} {...props} />);
    await nextFrames(45);
    watch.stop();
    expect(watch.tops.length).toBeGreaterThan(20);
    expect(watch.covered).toEqual([]);
  });

  it("moves the popup at once to the slot Root keeps active", async () => {
    // A flat line of seven points. The update shows k3 to k9, and k5 stays active, now third.
    const { host, rerender } = renderThemed(<Scene rows={named([50, 50, 50, 50, 50, 50, 50])} kind="line" />);
    await hoverSlot(host, 5, 7, "point");
    await nextFrames(20);
    const from = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    const watch = watchFrames(host);
    rerender(<Scene rows={named([50, 50, 50, 50, 50, 50, 50], 3)} kind="line" />);
    await nextFrames(30);
    watch.stop();
    expect(label()).toBe("k5");
    const to = positioner()?.getBoundingClientRect().left ?? Number.NaN;
    expect(from - to).toBeGreaterThan(100);
    expect(
      watch.lefts.every((left) => Math.abs(left - from) <= 0.5 || Math.abs(left - to) <= 0.5),
      JSON.stringify({ from, to, lefts: watch.lefts })
    ).toBe(true);
  });
});

describe("a step onto a label that changes the popup's size", () => {
  it("keeps the top edge of a popup below the plot, so it grows away from the bars", async () => {
    // Full bars under a plot near the viewport's top leave no room above, so the popup sits below.
    const rows = [
      { name: "Q1", v: 100 },
      { name: "The third quarter of the fiscal year, after the summer", v: 100 },
      { name: "Q3", v: 100 },
    ];
    const { host } = renderThemed(
      <Scene rows={rows} kind="bars" popupWidth={128} padding="8px 24px 400px" />
    );
    await hoverSlot(host, 0, 3, "band");
    await nextFrames(20);
    expect(positioner()?.getAttribute("data-side")).toBe("bottom");
    const watch = watchFrames(host);
    await hoverSlot(host, 1, 3, "band");
    await nextFrames(20);
    watch.stop();
    expect(positioner()?.getAttribute("data-side")).toBe("bottom");
    expect(label()).toBe(rows[1]?.name);
    expect(watch.covered).toEqual([]);
  });

  it("jumps when the wider popup at its old place would cover the tall bar beside it", async () => {
    const rows = [
      { name: "Q1", v: 25 },
      { name: "A long name for the middle quarter of the year", v: 100 },
      { name: "Q3", v: 25 },
    ];
    const { host } = renderThemed(<Scene rows={rows} kind="bars" />);
    await hoverSlot(host, 0, 3, "band");
    await nextFrames(20);
    const narrow = popup()?.getBoundingClientRect().width ?? 0;
    const watch = watchFrames(host);
    await hoverSlot(host, 1, 3, "band");
    await nextFrames(20);
    watch.stop();
    expect(popup()?.getBoundingClientRect().width ?? 0).toBeGreaterThan(narrow + 100);
    expect(watch.covered).toEqual([]);
  });
});

/**
 * A rising step under a 240 px popup, with room above the plot, where the popup's glide can clear
 * the dot.
 */
async function readerStepScene() {
  await page.viewport(1024, 1200);
  const { host } = renderThemed(
    <Scene rows={named([10, 90, 40, 60, 20, 70])} kind="line" popupWidth={240} padding="480px 24px 24px" />
  );
  await hoverSlot(host, 0, 6, "point");
  await nextFrames(30);
  await glideLanded();
  return host;
}

describe("an active dot on a reader step", () => {
  it("shows between its two centres at set times of its glide", async () => {
    // The step is dispatched at once, so the sweep pauses the dot's glide before any frame runs.
    // The places it reads depend on the glide, not on how many frames the runner delivers.
    const host = await readerStepScene();
    const [start] = dotFrame(host);
    dispatchSlotMove(host, 1 / 5);
    const places = sweepGlides(host, () => dotFrame(host)).flat();
    // The popup's text follows the step in the next render.
    await nextFrames(2);
    expect(label()).toBe("k1");
    const end = places.at(-1);
    if (start === undefined || end === undefined) throw new Error("no active dot");
    expect(start.y - end.y).toBeGreaterThan(100);
    const between = places.filter(({ y }) => y < start.y - 1 && y > end.y + 1);
    expect(between.length, JSON.stringify(places)).toBeGreaterThan(0);
  });

  it("lands on its new reading while the popup glides clear of it", async () => {
    // The real pointer step, which the popup's own glide follows over real frames.
    const host = await readerStepScene();
    const [start] = dotFrame(host);
    const watch = watchFrames(host);
    await hoverSlot(host, 1, 6, "point");
    await nextFrames(40);
    await glideLanded();
    watch.stop();
    expect(label()).toBe("k1");
    const [end] = dotFrame(host);
    if (start === undefined || end === undefined) throw new Error("no active dot");
    expect(start.y - end.y).toBeGreaterThan(100);
    expect(end.gliding).toBe(false);
    expect(watch.covered).toEqual([]);
  });
});

/**
 * Eight 100 px bands whose bars fill a tenth of each, and a 180 px popup, which over k1 reaches
 * neither k0's nor k2's bar. k2 stands nine times as tall as the rest.
 */
const FAR_ROWS = named([10, 10, 90, 10, 10, 10, 10, 10]);

function FarScene({ barDot }: { readonly barDot: boolean }) {
  return (
    <Scene
      rows={FAR_ROWS}
      kind="bars"
      barDot={barDot}
      bandGap="90%"
      popupWidth={180}
      plotWidth={800}
      padding="320px 24px 24px"
    />
  );
}

/** A pointer move onto one of the eight bands, by `nudge` px to its right, as the chart's own events. */
function moveFar(host: HTMLElement, slot: number, nudge = 0): void {
  dispatchSlotMove(host, (slot + 0.5) / 8, nudge);
}

/**
 * A fast step from k1 to k2 while the popup rests over k1: a quick nudge, then the step. The dot
 * climbs the straight track over the empty gap and through the popup's columns while the popup
 * still rests there.
 *
 * @returns What the frames showed.
 */
async function farStep(host: HTMLElement) {
  const watch = watchFrames(host);
  moveFar(host, 1, 2);
  await nextFrames(1);
  moveFar(host, 2);
  await nextFrames(60);
  await glideLanded();
  watch.stop();
  return watch;
}

describe("an active dot on bars far apart", () => {
  it("never meets the popup while it climbs toward a tall bar beyond the popup's width", async () => {
    const { host } = renderThemed(<FarScene barDot />);
    moveFar(host, 1);
    await nextFrames(40);
    await glideLanded();
    const watch = await farStep(host);
    expect(label()).toBe("k2");
    expect(watch.covered).toEqual([]);
  });

  it("never meets the popup when the dot mounts while the popup shows", async () => {
    // The popup opens over the bars alone, and the dot mounts through local state while it shows.
    let showDot: (shown: boolean) => void = () => undefined;
    function LateDot() {
      const [shown, setShown] = useState(false);
      useLayoutEffect(() => {
        showDot = setShown;
      }, []);
      return <FarScene barDot={shown} />;
    }
    const { host } = renderThemed(<LateDot />);
    moveFar(host, 1);
    await nextFrames(40);
    await glideLanded();
    showDot(true);
    await nextFrames(10);
    // DOM audit: the active dot is aria-hidden plot output, so its slot is the only locator.
    expect(host.querySelector('[data-slot="chart-active-dot"][data-value]')).not.toBeNull();
    const watch = await farStep(host);
    expect(label()).toBe("k2");
    expect(watch.covered).toEqual([]);
  });
});

describe("an active dot over a gap in its line", () => {
  it("moves at once across the gap, and nothing covers it", async () => {
    // k1 is missing and the line leaves a gap there, so no line runs from k0 to k2 to ride.
    const rows: Row[] = [
      { name: "k0", v: 20 },
      { name: "k1", v: null },
      { name: "k2", v: 80 },
      ...named([60, 40, 50], 3),
    ];
    const { host } = renderThemed(<Scene rows={rows} kind="line" />);
    await hoverSlot(host, 0, 6, "point");
    await nextFrames(30);
    await glideLanded();
    const [start] = dotFrame(host);
    const watch = watchFrames(host);
    const dots = watchDots(host);
    await hoverSlot(host, 2, 6, "point");
    await nextFrames(30);
    await glideLanded();
    watch.stop();
    dots.stop();
    expect(label()).toBe("k2");
    const [end] = dotFrame(host);
    if (start === undefined || end === undefined) throw new Error("no active dot");
    expect(start.y - end.y).toBeGreaterThan(100);
    const at = (shown: DotFrame, place: DotFrame) =>
      Math.abs(shown.x - place.x) <= 0.5 && Math.abs(shown.y - place.y) <= 0.5;
    const shown = dots.frames.flat();
    expect(shown.length).toBeGreaterThan(5);
    expect(
      shown.every((dot) => !dot.gliding && (at(dot, start) || at(dot, end))),
      JSON.stringify(shown)
    ).toBe(true);
    expect(watch.covered).toEqual([]);
  });
});

/** A seeded source of numbers from 0 up to 1, so a scenario replays the same way every run. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

describe("any sequence of reader steps and data updates", () => {
  // The oracle for the whole class: in every frame of every scenario, the popup covers no drawn mark
  // by more than 1 px and keeps its top inside the viewport. Each scenario mixes pointer steps of
  // any width, value updates, slides of the window, a change of curve, transform and Root's stroke,
  // and labels long enough to resize the popup. Actions follow each other after 2 to 32 frames, so
  // many land in the middle of a tween or of a glide. Line scenarios draw one or two lines, each
  // with an active dot that glides on a step, and the popup must clear each dot in every frame.
  it.each([
    [11, "any", 0.15],
    [23, "any", 0.15],
    [37, "any", 0.15],
    [59, "any", 0.15],
    [71, "any", 0.15],
    [97, "any", 0.15],
    // The third entry is the share of an action's roll that slides the window. Other scenarios slide
    // on 15 % of actions by one to three slots. Sparse bar scenarios hover a slot on every action,
    // then slide by two to four slots on 60 % of them or leave one tall bar among zeros, so the lone
    // bar often slides past a popup resting near the floor.
    [13, "bars", 0.21],
    [29, "bars", 0.21],
    [41, "bars", 0.21],
    [53, "bars", 0.21],
    [67, "bars", 0.21],
    [83, "bars", 0.21],
    // Bars of any readings with an active dot that rides their tops on every step.
    [17, "bar-dot", 0.15],
    [31, "bar-dot", 0.15],
    [43, "bar-dot", 0.15],
  ] as const)(
    "keeps the popup off every mark in scenario %i (%s marks)",
    { timeout: 120_000 },
    async (seed, marks, slides) => {
      const random = seeded(seed);
      const pick = (count: number) => Math.floor(random() * count);
      const kind = marks !== "any" || random() < 0.5 ? "bars" : "line";
      const sparse = marks === "bars";
      // Sparse scenarios draw 5 to 7 bars on an 800 px plot, so each band is wider than half the
      // popup and a bar can leave its span on both sides of a slide.
      const count = sparse ? 5 + pick(3) : 5 + pick(5);
      let first = 0;
      const curves = ["linear", "natural", "monotone", "step", "bump", "basis"] as const;
      let curve: ChartCurve = curves[pick(curves.length)] ?? "linear";
      let stroke = "2px";
      let markStyle: { readonly transform: string } | undefined;
      const name = (index: number) =>
        !sparse && random() < 0.2
          ? `k${String(index)}, a long name that makes the popup wider`
          : `k${String(index)}`;
      const reading = () => (sparse ? 0 : Math.round(random() * 100));
      // A stream of its own picks a second line and its readings, so each scenario keeps the steps
      // and updates it drew before. Scenarios 11 and 71 draw two lines, 37 and 97 one.
      const other = seeded(seed + 1);
      const second = kind === "line" && other() < 0.5;
      const secondReading = () => (second ? { w: Math.round(other() * 100) } : {});
      // One tall bar at a random slot among sparse readings, any readings otherwise.
      const values = () => {
        const tall = pick(count);
        return Array.from({ length: count }, (_, index) =>
          sparse && index === tall ? 60 + pick(41) : reading()
        );
      };
      let rows: Row[] = values().map((v, index) => ({ name: name(index), v, ...secondReading() }));
      const scene = () => (
        <Scene
          rows={rows}
          kind={kind}
          curve={curve}
          markStyle={markStyle}
          stroke={stroke}
          plotWidth={sparse ? 800 : 600}
          padding="220px 24px 24px"
          second={second}
          barDot={marks === "bar-dot"}
        />
      );
      const { host, rerender } = renderThemed(scene());
      await nextFrames(2);
      const watch = watchFrames(host, "moving");
      const scale = kind === "line" ? "point" : "band";
      for (let action = 0; action < (sparse ? 16 : 12); action += 1) {
        if (sparse) await hoverSlot(host, pick(count), count, scale);
        const roll = sparse ? 0.55 + random() * 0.35 : random();
        if (roll < 0.55) {
          await hoverSlot(host, pick(count), count, scale);
        } else if (roll < 0.9 - slides) {
          const next = values();
          rows = rows.map((row, index) => ({ ...row, v: next[index] ?? 0, ...secondReading() }));
          rerender(scene());
        } else if (roll < 0.9) {
          // The window slides, and new slots enter at the end.
          const by = (sparse ? 2 : 1) + pick(3);
          first += by;
          rows = [
            ...rows.slice(by),
            ...Array.from({ length: by }, (_, index) => ({
              name: name(first + count - by + index),
              v: reading(),
              ...secondReading(),
            })),
          ];
          rerender(scene());
        } else {
          curve = curves[pick(curves.length)] ?? "linear";
          markStyle = markStyle === undefined ? { transform: "translateY(-24px)" } : undefined;
          stroke = stroke === "2px" ? "12px" : "2px";
          rerender(scene());
        }
        // Between 2 and 32 frames, so the next action can land in the middle of a 480 ms tween.
        await nextFrames(2 + pick(31));
      }
      // The last tween ends before the watch does.
      await nextFrames(32);
      watch.stop();
      expect(watch.tops.length).toBeGreaterThan(50);
      expect(Math.min(...watch.tops)).toBeGreaterThanOrEqual(0);
      expect(watch.covered).toEqual([]);
    }
  );
});
