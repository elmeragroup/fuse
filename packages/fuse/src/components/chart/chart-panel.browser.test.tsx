// Composed Panels in Chromium, after ticket svg-3's checks. Unit under test: Root over two
// Chart.Panel rows, from the model to the drawn bars, vertices, guides and option. Oracles: pixels
// worked out by hand on a 400 by 200 px plot per Panel, where the Oslo fall-back day of
// 2025-10-26 holds 100 quarter cells of 4 px and 25 hourly slots of 16 px, so hour k's bar runs
// from 16k + 2 to 16k + 14 px under the 25 % band gap (ticket 07's P4); the eased progress of
// motion-frames.json, which .scratch/charts-v1/tools/l05-oracles/motion_fixture.py writes by hand
// from cubic-bezier(0, 0.7, 0.5, 1); and the option forms of format/fixtures/time-literals.ts.
// The Panel rules live in chart-panel-rules and the coarse series in chart-coarse.
import { Profiler, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";

import { afterEach, describe, expect, it } from "vitest";
import { cdp, page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { installFrameClock } from "../../../test/chart/frame-clock";
import type { FrameClock } from "../../../test/chart/frame-clock";
import { Composed, Levels, PAIR, PAIR_CONFIG } from "../../../test/chart/panel-fixtures";
import type { Level } from "../../../test/chart/panel-fixtures";
import {
  barBoxes,
  barHeights,
  easedAt,
  frame,
  lineVertices,
  onGrid,
  plotOf,
  rectOf,
} from "../../../test/chart/panel-readers";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig } from "./chart-types";
import "./chart.css";

/** The device metrics Chromium emulates. */
type DeviceMetrics = {
  readonly width: number;
  readonly height: number;
  readonly deviceScaleFactor: number;
  readonly mobile: boolean;
};

type MetricsCdp = {
  send: ((method: "Emulation.setDeviceMetricsOverride", params: DeviceMetrics) => Promise<void>) &
    ((method: "Emulation.clearDeviceMetricsOverride") => Promise<void>);
};

// SAFETY: vitest types CDPSession as {}; Playwright's session implements send.
const session = (): MetricsCdp => cdp() as MetricsCdp;

let clock: FrameClock | null = null;

afterEach(async () => {
  clock?.restore();
  clock = null;
  await session().send("Emulation.clearDeviceMetricsOverride");
});

describe("two Panels on one x grid", () => {
  it("draws hour k's bar from 16k + 2 to 16k + 14 px and each quarter's vertex on its column, then again after a resize", async () => {
    const { host, rerender } = renderThemed(<Composed />);
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    await expect.poll(() => host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(25);
    const expected = (step: number) => ({
      // Hour k spans 4 quarters of `step` px, less a 25 % band gap split around it.
      bars: Array.from({ length: 25 }, (_, k) => ({
        left: 4 * step * k + step / 2,
        right: 4 * step * k + 3.5 * step,
        top: 200 - 40 * ((k % 5) + 1),
        bottom: 200,
      })),
      // Each vertex sits on the centre of the 1 px column the crosshair draws at its quarter's
      // centre, and at 200 px less 200 px times its price on a domain of [0, 1].
      vertices: Array.from(
        { length: 100 },
        (_, q) => [step * q + step / 2 + 0.5, 200 - 50 * (q % 4)] as const
      ),
    });
    expect(barBoxes(host)).toEqual(expected(4).bars);
    expect(lineVertices(host)).toEqual(expected(4).vertices);
    // Both plots share one left edge and width, and the second sits below the first.
    const [upper, lower] = [plotOf(host, 0), plotOf(host, 1)];
    expect([lower.left, lower.width, upper.width, upper.height, lower.height]).toEqual([
      upper.left,
      400,
      400,
      200,
      200,
    ]);
    expect(lower.top).toBeGreaterThanOrEqual(upper.bottom + 16);
    rerender(<Composed width={800} />);
    await expect.poll(() => plotOf(host, 1).width).toBe(800);
    await expect.poll(() => barBoxes(host)).toEqual(expected(8).bars);
    expect(lineVertices(host)).toEqual(expected(8).vertices);
  });

  it("lists 100 Table rows with each hour's consumption once, spanning its 4 rows", async () => {
    const { host } = renderThemed(<Composed />);
    await expect.poll(() => host.querySelectorAll("tbody tr").length).toBe(100);
    const rows = [...host.querySelectorAll("tbody tr")];
    // Rows 0 to 3 are hour 0: the first holds the price and the hour's cell, the rest the price.
    expect(rows.slice(0, 5).map((row) => row.querySelectorAll("td").length)).toEqual([2, 1, 1, 1, 2]);
    const spans = rows.flatMap((row) =>
      [...row.querySelectorAll("td[rowspan]")].map((cell) => cell.getAttribute("rowspan"))
    );
    expect(spans).toEqual(Array.from({ length: 25 }, () => "4"));
    expect(rows[0]?.querySelector("td[rowspan]")?.textContent).toBe("1");
    expect(rows[96]?.querySelector("td[rowspan]")?.textContent).toBe("5");
  });
});

describe("one active column across Panels", () => {
  it.each([1, 1.5, 2])(
    "puts both crosshairs, both active bars, the option and the popup on one column at a %sx pixel ratio",
    async (ratio) => {
      if (ratio !== 1) {
        await session().send("Emulation.setDeviceMetricsOverride", {
          width: 1024,
          height: 768,
          deviceScaleFactor: ratio,
          mobile: false,
        });
        await frame();
      }
      expect(devicePixelRatio).toBe(ratio);
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO">
          <div style={{ marginLeft: 13.37, width: 517.5, paddingTop: 160 }}>
            <button type="button">før</button>
            <Chart.Root data-intro="none" data={PAIR} config={PAIR_CONFIG} xKey="name" aria-label="To rader">
              <Chart.Panel series={["v"]}>
                <Chart.YAxis />
                <Chart.Crosshair />
                <Chart.Bar dataKey="v" />
              </Chart.Panel>
              <Chart.Panel series={["w"]}>
                <Chart.YAxis />
                <Chart.Crosshair />
                <Chart.Bar dataKey="w" />
                <Chart.XAxis />
              </Chart.Panel>
              <Chart.Tooltip />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
      host.querySelector("button")?.focus();
      await userEvent.keyboard("{Tab}{ArrowRight}{ArrowRight}");
      await frame();
      await frame();
      // DOM audit: the option, the crosshairs, the overlays and the popup are the parts under test.
      const option = rectOf(document.activeElement);
      // DOM audit: the crosshairs are aria-hidden plot output.
      const bands = [...host.querySelectorAll('[data-slot="chart-crosshair"] rect')].map(rectOf);
      const overlays = [...host.querySelectorAll('[data-slot="chart-bar-active"]')].map(rectOf);
      const plots = [0, 1].map((panel) => plotOf(host, panel));
      const popup = rectOf(document.querySelector('[data-slot="chart-tooltip"]'));
      expect(bands).toHaveLength(2);
      expect(overlays).toHaveLength(2);
      const centre = (option.left + option.right) / 2;
      bands.forEach((band, panel) => {
        expect(band.left).toBeCloseTo(option.left, 2);
        expect(band.right).toBeCloseTo(option.right, 2);
        expect(onGrid(band.left - (plots[panel]?.left ?? 0))).toBe(true);
      });
      for (const bar of overlays) {
        expect(onGrid(bar.left - (plots[0]?.left ?? 0)) && onGrid(bar.right - (plots[0]?.left ?? 0))).toBe(
          true
        );
        // A bar keeps the band's middle, so each side's gap differs by one device pixel at most.
        expect(Math.abs((bar.left + bar.right) / 2 - centre)).toBeLessThanOrEqual(0.5 / ratio + 0.01);
      }
      // Base UI centres the popup on the anchor and rounds its place to a device pixel.
      expect(Math.abs((popup.left + popup.right) / 2 - centre)).toBeLessThanOrEqual(1);
    }
  );
});

describe("one listbox over every Panel", () => {
  it("takes one tab stop, walks the shared x and moves the series focus from the first Panel into the second", async () => {
    const { host } = renderThemed(<Composed />);
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    await expect.poll(() => host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(25);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.getAttribute("role")).toBe("option");
    expect(host.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    // Quarter 5 is 01:15 to 01:30, in hour 1, whose consumption is 2 kWh, and its price is 1/4.
    const quarter = "kl. 01:15 til 01:30";
    const hour = "kl. 01 til 02";
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      `${quarter}: Forbruk ${hour} 2 kilowattimer, Pris 0,25`
    );
    expect(document.activeElement?.getAttribute("aria-posinset")).toBe("6");
    expect(document.activeElement?.getAttribute("aria-setsize")).toBe("100");
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      `Forbruk ${hour} 2 kilowattimer, ${quarter}`
    );
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Pris 0,25, ${quarter}`);
    // The cycle ends at the last series of the last Panel.
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.getAttribute("aria-label")).toBe(`Pris 0,25, ${quarter}`);
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.textContent).toBe("Vis som tabell");
  });

  it("puts the hour's band over the active quarter in the coarse Panel and the quarter's in the other", async () => {
    const { host } = renderThemed(
      <Composed top={<Chart.Crosshair variant="band" />} bottom={<Chart.Crosshair variant="band" />} />
    );
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    await expect.poll(() => host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(25);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}");
    await frame();
    // DOM audit: the crosshairs are aria-hidden plot output.
    const bands = [...host.querySelectorAll('[data-slot="chart-crosshair"] rect')].map((rect) => [
      Number(rect.getAttribute("x")),
      Number(rect.getAttribute("width")),
    ]);
    // Hour 1 covers 16 to 32 px, and quarter 5 covers 20 to 24 px.
    expect(bands).toEqual([
      [16, 16],
      [20, 4],
    ]);
  });
});

describe("pointer picking across Panels", () => {
  it("picks the slot by x and the nearest series of the Panel under the pointer, and none in a one-key Panel", async () => {
    const rows = [
      { name: "a", lo: 1, hi: 9, solo: 4 },
      { name: "b", lo: 2, hi: 8, solo: 5 },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={{
              lo: { label: "Lav", color: "chart-1" },
              hi: { label: "Høy", color: "chart-2" },
              solo: { label: "Alene", color: "chart-3" },
            }}
            xKey="name"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Plukk">
            <Chart.Panel series={["lo", "hi"]} yInclude={[10]}>
              <Chart.Bar dataKey="lo" />
            </Chart.Panel>
            <Chart.Panel series={["solo"]} yInclude={[10]}>
              <Chart.Bar dataKey="solo" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: bars are aria-hidden plot output, so their slot is the only locator.
    await expect.poll(() => host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(4);
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const root = host.querySelector<HTMLElement>('[data-slot="chart"]');
    const move = (clientX: number, clientY: number) =>
      surface?.dispatchEvent(
        new PointerEvent("pointermove", { bubbles: true, clientX, clientY, pointerType: "mouse" })
      );
    const [upper, lower] = [plotOf(host, 0), plotOf(host, 1)];
    // Slot b's band is the right half. On [0, 10], 2 sits at 160 px and 8 at 40 px, so 150 px
    // lies nearer lo, at index 0, and 50 px nearer hi, at index 1.
    move(upper.left + 300, upper.top + 150);
    expect(root?.dataset.near).toBe("0");
    expect(root?.getAttribute("data-active")).toBe("pointer");
    move(upper.left + 300, upper.top + 50);
    expect(root?.dataset.near).toBe("1");
    // The lower Panel holds one key, so the pointer there picks the slot and no series.
    move(lower.left + 100, lower.top + 20);
    expect(root?.dataset.near).toBeUndefined();
    expect(root?.getAttribute("data-active")).toBe("pointer");
  });
});

describe("motion under Panels", () => {
  it("maps each Panel's running tween by its own resize, so each finishes on its own target (E6)", async () => {
    clock = installFrameClock();
    const { host, rerender } = renderThemed(<Levels data={[{ name: "a", up: 0, down: 0 }]} />);
    await expect.poll(() => barHeights(host)).toEqual([0, 0]);
    // Both bars head for 2 of [0, 4], 100 px of 200. The resize below keeps the same rows, so it is
    // no data update.
    const target = [{ name: "a", up: 2, down: 2 }];
    rerender(<Levels data={target} />);
    clock.frameAt(clock.now() + 120);
    const at120 = 100 * easedAt(120);
    expect(barHeights(host).map(Math.round)).toEqual([Math.round(at120), Math.round(at120)]);
    // The first Panel doubles its height and the second halves it: 100 px heads for 200 and 50.
    rerender(<Levels data={target} heights={[400, 100]} />);
    await expect.poll(() => plotOf(host, 1).height).toBe(100);
    // Each bar keeps its share of the way, drawn in its own Panel's box.
    expect(barHeights(host).map(Math.round)).toEqual([Math.round(2 * at120), Math.round(at120 / 2)]);
    clock.frameAt(clock.now() + 120);
    expect(barHeights(host).map(Math.round)).toEqual([
      Math.round(200 * easedAt(240)),
      Math.round(50 * easedAt(240)),
    ]);
    clock.frameAt(clock.now() + 600);
    expect(barHeights(host)).toEqual([200, 50]);
  });

  it("moves both Panels on one clock, with a Panel's reference line on its bar's top in every frame", async () => {
    clock = installFrameClock();
    const line = (value: number) => <Chart.ReferenceLine y={value} />;
    const { host, rerender } = renderThemed(
      <Levels data={[{ name: "a", up: 1, down: 3 }]} top={line(1)} bottom={line(3)} />
    );
    await expect.poll(() => barHeights(host)).toEqual([50, 150]);
    rerender(<Levels data={[{ name: "a", up: 3, down: 1 }]} top={line(3)} bottom={line(1)} />);
    // DOM audit: the reference rules and bars are aria-hidden plot output.
    const rules = () =>
      [...host.querySelectorAll('[data-slot="chart-reference-line"] line')].map((rule) =>
        Number(rule.getAttribute("y1"))
      );
    const tops = () =>
      [...host.querySelectorAll('[data-slot="chart-bar"]')].map((bar, panel) => {
        const plot = plotOf(host, panel);
        return bar.getBoundingClientRect().top - plot.top;
      });
    for (const ms of [120, 240, 360] as const) {
      clock.frameAt(1000 + ms);
      const eased = easedAt(ms);
      // Panel 1 grows from 50 to 150 px and Panel 2 shrinks from 150 to 50 px, on one progress.
      expect(barHeights(host).map(Math.round)).toEqual([
        Math.round(50 + 100 * eased),
        Math.round(150 - 100 * eased),
      ]);
      // A 1 px rule's centre line lies half a pixel below the bar's top edge, on the same pixel.
      expect(rules().map((y) => Math.floor(y))).toEqual(tops().map((y) => Math.round(y)));
    }
  });

  it("commits nothing while the pointer sweeps both Panels or a data update tweens", async () => {
    let commits = 0;
    const counted = (data: readonly Level[]) => (
      <Profiler id="chart" onRender={() => (commits += 1)}>
        <Levels data={data} top={<Chart.Crosshair />} bottom={<Chart.Crosshair />} />
      </Profiler>
    );
    const { host, rerender } = renderThemed(
      counted([
        { name: "a", up: 1, down: 3 },
        { name: "b", up: 2, down: 2 },
      ])
    );
    await expect.poll(() => barHeights(host).length).toBe(4);
    await frame();
    commits = 0;
    const surface = host.querySelector<HTMLElement>('[role="listbox"]');
    const box = surface?.getBoundingClientRect() ?? new DOMRect();
    for (let step = 0; step < 120; step += 1) {
      // A diagonal sweep that crosses from the first Panel into the second.
      surface?.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          clientX: box.left + (box.width * (step + 0.5)) / 120,
          clientY: box.top + (box.height * (step + 0.5)) / 120,
          pointerType: "mouse",
        })
      );
      await frame();
    }
    expect(commits).toBe(0);
    rerender(
      counted([
        { name: "a", up: 3, down: 1 },
        { name: "b", up: 1, down: 3 },
      ])
    );
    await frame();
    commits = 0;
    for (let step = 0; step < 30; step += 1) await frame();
    expect(commits).toBe(0);
  });
});

describe("reference labels per Panel (E7)", () => {
  it("keeps a 16 px label at local y=100 on its guide in each of two 200 px Panels", async () => {
    const label = (value: number) => <Chart.ReferenceLine y={value} label="Snitt" />;
    const { host } = renderThemed(
      <Levels data={[{ name: "a", up: 1, down: 1 }]} top={label(2)} bottom={label(2)} />
    );
    await expect.poll(() => barHeights(host)).toEqual([50, 50]);
    // DOM audit: the labels are aria-hidden plot text, and each sits in its Panel's reference.
    const labels = [...host.querySelectorAll('[data-slot="chart-reference-label"]')];
    expect(labels).toHaveLength(2);
    labels.forEach((node, panel) => {
      // 2 of [0, 4] lies 100 px down a 200 px plot, and the label's bottom sits on its guide.
      expect(node.getBoundingClientRect().bottom - plotOf(host, panel).top).toBe(100);
    });
  });

  it("reserves the slot label row above the Panel that holds a slot label, and leaves the other's labels free", async () => {
    const { host } = renderThemed(
      <Levels
        data={[{ name: "a", up: 1, down: 1 }]}
        top={<Chart.ReferenceLine x="a" label="Nå" />}
        bottom={<Chart.ReferenceLine y={3.96} label="Topp" />}
      />
    );
    await expect.poll(() => barHeights(host)).toEqual([50, 50]);
    // 3.96 of [0, 4] lies 2 px down the lower plot, so its 16 px label reaches 14 px above the plot,
    // which only a row of slot labels above that same plot would forbid.
    // DOM audit: the reference label is aria-hidden plot text inside its reference.
    const value = host
      .querySelectorAll('[data-slot="chart-reference-line"]')[1]
      ?.querySelector('[data-slot="chart-reference-label"]');
    expect((value?.getBoundingClientRect().bottom ?? 0) - plotOf(host, 1).top).toBe(2);
    // The upper Panel's slot label holds a row of its own above the upper plot.
    // DOM audit: a Panel is a layout row with no role, so its slot locates it.
    const [first] = host.querySelectorAll('[data-slot="chart-panel"]');
    expect(plotOf(host, 0).top - (first?.getBoundingClientRect().top ?? 0)).toBeGreaterThanOrEqual(20);
  });
});

describe("any number of Panels (W7, Q1-6 and B1-8)", () => {
  it("stacks nine Panels apart, one surface over all nine plots", async () => {
    const keys = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[Object.fromEntries([["name", "x"], ...keys.map((key, index) => [key, index + 1])])]}
            config={Object.fromEntries(keys.map((key) => [key, { label: key, color: "chart-1" }]))}
            xKey="name"
            data-intro="none"
            style={{ "--chart-plot-height": "40px" }}
            aria-label="Ni rader">
            {keys.map((key) => (
              <Chart.Panel key={key} series={[key]}>
                <Chart.YAxis />
                <Chart.Bar dataKey={key} />
              </Chart.Panel>
            ))}
            <Chart.Legend />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    // DOM audit: bars are aria-hidden plot output, counted to wait for every Panel's draw.
    await expect.poll(() => host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(9);
    const plots = keys.map((_, panel) => plotOf(host, panel));
    // Each 40 px plot sits a 16 px gap below the one before it, and all share one left edge.
    plots.slice(1).forEach((plot, index) => {
      const above = plots[index] ?? plot;
      expect(plot.top - above.bottom, `Panel ${String(index + 2)}`).toBeGreaterThanOrEqual(16);
      expect([plot.left, plot.width, plot.height]).toEqual([above.left, above.width, 40]);
    });
    // DOM audit: the surface, the legend and the Panels' rows are layout under test.
    const surface = host.querySelector('[role="listbox"]')?.getBoundingClientRect() ?? new DOMRect();
    const [first] = plots;
    const last = plots.at(-1);
    expect([surface.top, surface.bottom, surface.left, surface.width]).toEqual([
      first?.top,
      last?.bottom,
      first?.left,
      first?.width,
    ]);
    // The legend follows the last Panel.
    const legend = host.querySelector('[data-slot="chart-legend"]')?.getBoundingClientRect() ?? new DOMRect();
    expect(legend.top).toBeGreaterThanOrEqual(last?.bottom ?? Number.POSITIVE_INFINITY);
  });
});

describe("value labels at their own Panel's value axis (W8 and W9)", () => {
  /** One Panel with a bar at 2 of [0, 4] and its ActiveValue and value line, with or without an axis. */
  function Valued({ axis }: { readonly axis: boolean }): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data={[{ name: "a", v: 2 }]}
            config={{ v: { label: "V", color: "chart-1" } }}
            xKey="name"
            data-intro="none"
            defaultActiveX="a"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Verdi">
            <Chart.Panel series={["v"]} yInclude={[4]}>
              {axis ? <Chart.YAxis /> : null}
              <Chart.Bar dataKey="v" />
              <Chart.ActiveValue dataKey="v" />
              <Chart.ActiveValueLine dataKey="v">
                <Chart.ValueLabel />
              </Chart.ActiveValueLine>
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("draws ActiveValue above its bar's top, centred on the bar (B1-6)", async () => {
    // 2 of [0, 4] tops the bar at 100 px of 200, so the value's box ends 0.25rem, 4 px, above it.
    const { host } = renderThemed(<Valued axis={false} />);
    // DOM audit: bars are aria-hidden plot output, counted to wait for the draw.
    await expect.poll(() => host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(1);
    const plot = plotOf(host, 0);
    // DOM audit: the bar and the value are aria-hidden plot output.
    const bar = host.querySelector('[data-slot="chart-bar"]')?.getBoundingClientRect() ?? new DOMRect();
    const value =
      host.querySelector('[data-slot="chart-active-value"]')?.getBoundingClientRect() ?? new DOMRect();
    await expect
      .poll(() => host.querySelector('[data-slot="chart-active-value"]')?.getBoundingClientRect().bottom)
      .toBe(plot.top + 96);
    expect(Math.abs(value.left + value.width / 2 - (bar.left + bar.width / 2))).toBeLessThanOrEqual(0.5);
  });

  it("puts the value line's pill over its Panel's start axis, and inside a Panel with none (B1-7)", async () => {
    const pill = (host: HTMLElement) =>
      // DOM audit: the pill is aria-hidden plot text inside the value line.
      host
        .querySelector('[data-slot="chart-active-value-line"] [data-slot="chart-value-label"]')
        ?.getBoundingClientRect() ?? new DOMRect();
    const withAxis = renderThemed(<Valued axis />);
    await expect.poll(() => withAxis.host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(1);
    // With a start axis the pill ends 0.25rem before the plot's left edge, over the axis.
    expect(plotOf(withAxis.host, 0).left - pill(withAxis.host).right).toBeCloseTo(4, 1);
    withAxis.unmount();
    const without = renderThemed(<Valued axis={false} />);
    await expect.poll(() => without.host.querySelectorAll('[data-slot="chart-bar"]').length).toBe(1);
    // Without one it starts 0.25rem inside the plot.
    expect(pill(without.host).left - plotOf(without.host, 0).left).toBeCloseTo(4, 1);
  });
});

describe("series selection across Panels (B1-9)", () => {
  // Usage bars in the first Panel and a price line in the second. A selected series keeps full
  // opacity and the other dims to --chart-hover-dim, 0.45.
  function Selectable() {
    return (
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <div style={{ width: 300 }}>
          <Chart.Root
            data={[
              { name: "a", kwh: 2, price: 40 },
              { name: "b", kwh: 3, price: 60 },
            ]}
            config={{
              kwh: { label: "Forbruk", color: "chart-1" },
              price: { label: "Pris", color: "chart-2" },
            }}
            xKey="name"
            aria-label="Forbruk og pris">
            <Chart.Panel series={["kwh"]}>
              <Chart.Bar dataKey="kwh" />
            </Chart.Panel>
            <Chart.Panel series={["price"]}>
              <Chart.Line dataKey="price" />
            </Chart.Panel>
            <Chart.LegendToggleGroup />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The opacity of the bar series in the first Panel and the line series in the second. */
  function opacities(host: HTMLElement): number[] {
    // DOM audit: the series layers carry the dimming under test.
    return ['[data-slot="chart-bar-series"]', '[data-slot="chart-line-series"]'].map((selector) =>
      Number(getComputedStyle(host.querySelector(selector) ?? host).opacity)
    );
  }

  it("selects the second Panel's series with Down, Down and Enter, and dims the first Panel's", async () => {
    const { host } = renderThemed(<Selectable />);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowDown}{ArrowDown}{Enter}");
    // DOM audit: Root's data-selected and --chart-selected are its public paint contract.
    const root = host.querySelector<HTMLElement>('[data-slot="chart"]');
    expect(root?.hasAttribute("data-selected")).toBe(true);
    expect(root?.style.getPropertyValue("--chart-selected")).toBe("1");
    expect(
      // DOM audit: the toggle's data-series index ties it to the selected series.
      host.querySelector('[data-slot="chart-legend-toggle"][data-series="1"]')?.getAttribute("aria-pressed")
    ).toBe("true");
    await expect.poll(() => opacities(host)).toEqual([0.45, 1]);
  });

  it("selects the first Panel's series from its toggle, and dims the second Panel's", async () => {
    const { host } = renderThemed(<Selectable />);
    await userEvent.click(page.getByRole("button", { name: "Forbruk" }));
    await expect.poll(() => opacities(host)).toEqual([1, 0.45]);
  });
});

describe("the shared surface over the Panels' plots (X3, X4 and X5)", () => {
  // Two 200 px Panels a 16 px gap apart span 416 px, from the upper plot's top to the lower plot's
  // bottom, and the surface, the listbox, covers exactly that span.
  const rows = [{ name: "a", up: 1, down: 3 }];
  const config = {
    up: { label: "Opp", color: "chart-1" },
    down: { label: "Ned", color: "chart-2" },
  } as const satisfies ChartConfig;

  function Pair({
    order = ["up", "down"],
    scale = 1,
    top,
  }: {
    readonly order?: readonly ("up" | "down")[];
    readonly scale?: number;
    readonly top?: ReactNode;
  }): ReactNode {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200, transform: `scale(${String(scale)})`, transformOrigin: "0 0" }}>
          <Chart.Root
            data={rows}
            config={config}
            xKey="name"
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Par">
            {order.map((key) => (
              <Chart.Panel key={key} series={[key]} yInclude={[4]}>
                <Chart.Bar dataKey={key} />
                {key === "up" ? top : null}
              </Chart.Panel>
            ))}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  /** The surface's and both plots' client boxes, top and bottom. */
  function boxes(host: HTMLElement) {
    // DOM audit: the listbox is the surface under test, measured against the Panels' plots.
    const surface = rectOf(host.querySelector('[role="listbox"]'));
    return { surface, upper: plotOf(host, 0), lower: plotOf(host, 1) };
  }

  it("covers both plots after keyed Panels swap places (X3)", async () => {
    const { host, rerender } = renderThemed(<Pair />);
    await expect.poll(() => boxes(host).surface.height).toBe(416);
    rerender(<Pair order={["down", "up"]} />);
    await expect.poll(() => boxes(host).surface.height).toBe(416);
    const { surface, upper, lower } = boxes(host);
    expect([surface.top, surface.bottom]).toEqual([upper.top, lower.bottom]);
  });

  it("covers both plots under an ancestor's scale(0.5) (X4)", async () => {
    // At half size the plots draw 100 px each, 8 px apart, so the surface draws 208 px.
    const { host } = renderThemed(<Pair scale={0.5} />);
    await expect.poll(() => boxes(host).lower.height).toBe(100);
    await expect.poll(() => boxes(host).surface.height).toBe(208);
    const { surface, upper, lower } = boxes(host);
    expect([surface.top, surface.bottom]).toEqual([upper.top, lower.bottom]);
  });

  it("follows the plots when a slot label row appears in the upper Panel without a Root render (X5)", async () => {
    // A reference with its own state gains the slot label "Nå". The upper Panel reserves a row of
    // 20 px or more above its plot, which moves both plots down, and the surface moves with them.
    // Chromium re-lays the plots out here, so their own observation already catches this case.
    const control = { show: (): void => undefined };
    function Label(): ReactNode {
      const [label, setLabel] = useState<string | undefined>(undefined);
      useLayoutEffect(() => {
        control.show = () => {
          setLabel("Nå");
        };
      });
      return <Chart.ReferenceLine x="a" label={label} />;
    }
    const { host } = renderThemed(<Pair top={<Label />} />);
    await expect.poll(() => boxes(host).surface.height).toBe(416);
    const before = boxes(host).upper.top;
    control.show();
    await expect.poll(() => boxes(host).upper.top - before).toBeGreaterThanOrEqual(20);
    await expect.poll(() => boxes(host).surface.top).toBe(boxes(host).upper.top);
    const { surface, upper, lower } = boxes(host);
    expect([surface.top, surface.bottom, surface.height]).toEqual([upper.top, lower.bottom, 416]);
  });

  it("follows the plots when a Panel's own margin grows without a Root render (X5)", async () => {
    // A wrapper with its own state gives the upper Panel a 24 px top margin. Both plots move down
    // 24 px, neither plot nor Panel resizes, and the surface moves with them.
    const control = { push: (): void => undefined };
    function Pushed({ children }: { readonly children: ReactNode }): ReactNode {
      const [margin, setMargin] = useState(0);
      useLayoutEffect(() => {
        control.push = () => {
          setMargin(24);
        };
      });
      return (
        <Chart.Panel series={["up"]} yInclude={[4]} style={{ marginBlockStart: margin }}>
          {children}
        </Chart.Panel>
      );
    }
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 200 }}>
          <Chart.Root
            data={rows}
            config={config}
            xKey="name"
            data-intro="none"
            style={{ "--chart-plot-height": "200px" }}
            aria-label="Par">
            <Pushed>
              <Chart.Bar dataKey="up" />
            </Pushed>
            <Chart.Panel series={["down"]} yInclude={[4]}>
              <Chart.Bar dataKey="down" />
            </Chart.Panel>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    await expect.poll(() => boxes(host).surface.height).toBe(416);
    const before = boxes(host).upper.top;
    control.push();
    await expect.poll(() => boxes(host).upper.top - before).toBe(24);
    await expect.poll(() => boxes(host).surface.top).toBe(boxes(host).upper.top);
    const { surface, upper, lower } = boxes(host);
    expect([surface.top, surface.bottom, surface.height]).toEqual([upper.top, lower.bottom, 416]);
  });

  describe("keyed Panels a child reorders without rendering Root (Y3, Q3-2)", () => {
    /**
     * Panel A holds a slot label, whose row of 20 px sits above A's plot, and B holds none. First
     * [A, B]: A's plot runs from 20 to 220 px and B's from 236 to 436 px. Then [B, A]: B's runs from
     * 0 to 200 px and A's, after its 16 px gap and label row, from 236 to 436 px.
     */
    const panelA = (
      <Chart.Panel key="up" series={["up"]} yInclude={[4]}>
        <Chart.Bar dataKey="up" />
        <Chart.ReferenceLine x="a" label="Nå" />
      </Chart.Panel>
    );
    const panelB = (
      <Chart.Panel key="down" series={["down"]} yInclude={[4]}>
        <Chart.Bar dataKey="down" />
      </Chart.Panel>
    );

    /** The swap the mounted Swapping exposes, called from the test. */
    const control = { swap: (): void => undefined };

    function Swapping({ fresh }: { readonly fresh: boolean }): ReactNode {
      const [swapped, setSwapped] = useState(false);
      useLayoutEffect(() => {
        control.swap = () => {
          setSwapped(true);
        };
      });
      // Fresh elements render both Panels again. The same elements only move, so neither renders.
      const [first, second] = fresh
        ? [
            <Chart.Panel key="up" series={["up"]} yInclude={[4]}>
              <Chart.Bar dataKey="up" />
              <Chart.ReferenceLine x="a" label="Nå" />
            </Chart.Panel>,
            <Chart.Panel key="down" series={["down"]} yInclude={[4]}>
              <Chart.Bar dataKey="down" />
            </Chart.Panel>,
          ]
        : [panelA, panelB];
      return swapped ? [second, first] : [first, second];
    }

    function Swapped({ fresh }: { readonly fresh: boolean }) {
      return (
        <LocaleProvider locale="nb-NO">
          <div style={{ width: 200 }}>
            <Chart.Root
              data={rows}
              config={config}
              xKey="name"
              data-intro="none"
              style={{ "--chart-plot-height": "200px" }}
              aria-label="Par">
              <Swapping fresh={fresh} />
            </Chart.Root>
          </div>
        </LocaleProvider>
      );
    }

    /** The surface's top and height from the chart frame's top. */
    function span(host: HTMLElement): [number, number] {
      // DOM audit: the frame is the surface's containing block, located by its slot.
      const frameTop = rectOf(host.querySelector('[data-slot="chart-frame"]')).top;
      const { surface } = boxes(host);
      return [surface.top - frameTop, surface.height];
    }

    it("covers both plots after the reorder when the child renders the Panels again", async () => {
      const { host } = renderThemed(<Swapped fresh />);
      await expect.poll(() => span(host)).toEqual([20, 416]);
      await frame();
      await frame();
      control.swap();
      await expect.poll(() => span(host)).toEqual([0, 436]);
    });

    it("places the span again when a pointer enters the surface, after Panels that only moved", async () => {
      const { host } = renderThemed(<Swapped fresh={false} />);
      await expect.poll(() => span(host)).toEqual([20, 416]);
      await frame();
      await frame();
      control.swap();
      await userEvent.hover(page.getByRole("listbox"));
      await expect.poll(() => span(host)).toEqual([0, 436]);
    });
  });
});
