// Bar layout judges in Chromium, Firefox and WebKit. Oracles: section 8.15's hand-derived band of
// 40 px with 14 px grouped bars at 5 and 21 px, section 8.12's structural counts per form, section
// 8.14's plot heights, section 8.10's tie fixture, and metamorphic relations: a locale change
// leaves geometry unchanged, scaling the data scales the ticks, and an all-zero series added to a
// stack moves no other mark.
import type { ReactNode } from "react";

import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { barBox } from "../../../test/chart/bar-box";
import type { BarBox } from "../../../test/chart/bar-box";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import type { SupportedLocale } from "../../intl/locale-context";
import { Chart } from "./chart-namespace";
import type { ChartConfig, ChartQuality } from "./chart-types";
import "./chart.css";
import fallBack from "./format/fixtures/prices/fall-back-2025-10-26-quarter.json" with { type: "json" };
import spike from "./format/fixtures/prices/negative-spike-2026-05-24-quarter.json" with { type: "json" };

const TWO = {
  a: { label: "A", color: "chart-1" },
  b: { label: "B", color: "chart-2" },
} as const satisfies ChartConfig;

function bars(host: HTMLElement, series?: number): Element[] {
  const scope =
    series === undefined ? "" : `[data-slot="chart-bar-series"][data-series="${String(series)}"] `;
  // DOM audit: bars are aria-hidden plot output, so their slots are the only locator.
  return [...host.querySelectorAll(`${scope}[data-slot="chart-bar"]`)];
}

function plotOf(host: HTMLElement): DOMRect {
  // DOM audit: the bar series box is the plot box the clip-paths resolve against.
  return host.querySelector('[data-slot="chart-bar-series"]')?.getBoundingClientRect() ?? new DOMRect();
}

/** Finish the entrance, so geometry reads at rest. */
function settle(host: HTMLElement): void {
  // DOM audit: Root's figure holds every animation of the chart.
  for (const animation of host.querySelector('[data-slot="chart"]')?.getAnimations({ subtree: true }) ?? []) {
    if (Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)) animation.finish();
  }
}

function boxes(host: HTMLElement, series?: number): BarBox[] {
  settle(host);
  const plot = plotOf(host);
  return bars(host, series).map((bar) => barBox(bar, plot));
}

function near(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);
}

describe("bars in a band", () => {
  function two(children: ReactNode) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 80 }}>
          <Chart.Root
            data={[
              { name: "x", a: 4, b: 2 },
              { name: "y", a: 3, b: 1 },
            ]}
            config={TWO}
            xKey="name"
            aria-label="To">
            {children}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("draws a two-key group's bars 14 px wide at 5 and 21 px of a 40 px band", () => {
    const { host } = renderThemed(
      two(
        <Chart.BarGroup series={["a", "b"]}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      )
    );
    const [a] = boxes(host, 0);
    const [b] = boxes(host, 1);
    near(a?.left ?? 0, 5);
    near(a?.right ?? 0, 19);
    near(b?.left ?? 0, 21);
    near(b?.right ?? 0, 35);
    // The second band starts at 40 px.
    near(boxes(host, 0)[1]?.left ?? 0, 45);
  });

  it("fills the band less the 25 % gap outside a group", () => {
    const { host } = renderThemed(two(<Chart.Bar dataKey="a" />));
    const [first] = boxes(host);
    near(first?.left ?? 0, 5);
    near(first?.right ?? 0, 35);
  });
});

/** The quality of day index 20, estimated, and of day index 10, missing. */
function qualityAt(index: number): ChartQuality | undefined {
  if (index === 20) return "estimated";
  return index === 10 ? "missing" : undefined;
}

describe("structural counts per form", () => {
  function quarters(rows: readonly { readonly time_start: string; readonly SEK_per_kWh: number }[]) {
    return (
      <LocaleProvider locale="sv-SE">
        <Chart.Root
          data={rows.map((row) => ({ start: new Date(row.time_start), price: row.SEK_per_kWh }))}
          config={{ price: { label: "Spotpris", color: "chart-diverging" } }}
          xKey="start"
          interval="quarter-hour"
          timeZone="Europe/Stockholm"
          aria-label="Spotpris">
          <Chart.Bar dataKey="price" />
        </Chart.Root>
      </LocaleProvider>
    );
  }

  it("draws 96 boxes for the spike day's quarters", () => {
    expect(bars(renderThemed(quarters(spike)).host)).toHaveLength(96);
  });

  it("draws 100 boxes for the fall-back day's quarters", () => {
    expect(bars(renderThemed(quarters(fallBack)).host)).toHaveLength(100);
  });

  it("draws 365 days as one path per series, one per quality state and emphasis as overlay boxes", () => {
    // Oslo midnight is 23:00 UTC, and 22:00 UTC in summer time, from 31 March to 26 October 2025.
    const start = Date.UTC(2025, 0, 1, -1);
    const rows = Array.from({ length: 365 }, (_, index) => ({
      day: new Date(start + index * 86_400_000 - (index >= 89 && index <= 298 ? 3_600_000 : 0)),
      kwh: index === 10 ? null : 10 + (index % 30),
      q: qualityAt(index),
    }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{ kwh: { label: "Forbruk", color: "chart-1", qualityKey: "q" } }}
          xKey="day"
          interval="day"
          timeZone="Europe/Oslo"
          aria-label="Forbruk per dag">
          <Chart.Bar dataKey="kwh" emphasis="max" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host)).toHaveLength(0);
    // DOM audit: path-form bars are aria-hidden plot output.
    const paths = [...host.querySelectorAll('[data-slot="chart-bar-path"]')];
    expect(paths.map((path) => path.getAttribute("data-quality"))).toEqual([null, "estimated", "missing"]);
    // 39 is the highest value, on day indices 29, 59 and on to 359, so 12 days tie.
    expect(host.querySelectorAll('[data-slot="chart-bar-emphasis"]')).toHaveLength(12);
  });
});

describe("default plot heights", () => {
  it("draws the plot between 183 and 220 px tall at 358 px wide", () => {
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 358 }}>
          <Chart.Root data={[{ name: "x", a: 1, b: 1 }]} config={TWO} xKey="name" aria-label="Høyde">
            <Chart.Bar dataKey="a" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const height = plotOf(host).height;
    expect(height).toBeGreaterThanOrEqual(183);
    expect(height).toBeLessThanOrEqual(220);
  });

  it("draws 5 horizontal categories 160 px tall", () => {
    const rows = ["a", "b", "c", "d", "e"].map((name, index) => ({ name, a: index + 1, b: 1 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={rows} config={TWO} xKey="name" orientation="horizontal" aria-label="Rader">
          <Chart.Bar dataKey="a" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(plotOf(host).height).toBe(160);
  });

  it("gives the horizontal category axis the width of its longest label", () => {
    const rows = ["January", "February", "March"].map((name, index) => ({ name, a: index + 1, b: 1 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root data={rows} config={TWO} xKey="name" orientation="horizontal" aria-label="Rader">
          <Chart.XAxis />
          <Chart.Bar dataKey="a" />
        </Chart.Root>
      </LocaleProvider>
    );
    // DOM audit: the root and its ticks are aria-hidden plot output, so their slots are the locators.
    const root = host.querySelector('[data-slot="chart"]')?.getBoundingClientRect() ?? new DOMRect();
    const ticks = [...host.querySelectorAll('[data-slot="chart-x-tick"]')].map((tick) =>
      tick.getBoundingClientRect()
    );
    expect(ticks).toHaveLength(3);
    // Every label sits whole inside the root and ends left of the plot.
    for (const tick of ticks) {
      expect(tick.left).toBeGreaterThanOrEqual(root.left - 0.5);
      expect(tick.right).toBeLessThanOrEqual(plotOf(host).left + 0.5);
    }
  });
});

describe("emphasis", () => {
  it("selects every tied maximum and speaks the dictionary word in the option", async () => {
    const rows = [1, 3, 3, 2].map((a, index) => ({ name: `k${String(index + 1)}`, a, b: 0 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <button type="button">før</button>
        <Chart.Root data={rows} config={TWO} xKey="name" aria-label="Uthevet">
          <Chart.Bar dataKey="a" emphasis="max" />
        </Chart.Root>
      </LocaleProvider>
    );
    expect(bars(host).map((bar) => bar.hasAttribute("data-emphasis"))).toEqual([false, true, true, false]);
    host.querySelector("button")?.focus();
    await userEvent.keyboard("{Tab}{ArrowRight}{ArrowDown}");
    // The option moves focus to its new element after the commit, so the check waits for it.
    await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("A 3, uthevet, k2");
  });

  it("compares stack totals for a stacked bar", () => {
    const rows = [
      { name: "x", a: 5, b: 1 },
      { name: "y", a: 3, b: 4 },
    ];
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <Chart.Root
          data={rows}
          config={{
            a: { label: "A", color: "chart-1", stack: "s" },
            b: { label: "B", color: "chart-2", stack: "s" },
          }}
          xKey="name"
          aria-label="Stablet">
          <Chart.Bar dataKey="a" emphasis="max" />
          <Chart.Bar dataKey="b" />
        </Chart.Root>
      </LocaleProvider>
    );
    // The totals are 6 and 7, so y is the maximum although a is higher at x.
    expect(bars(host, 0).map((bar) => bar.hasAttribute("data-emphasis"))).toEqual([false, true]);
  });
});

const STACKED = {
  a: { label: "A", color: "chart-1", stack: "s" },
  b: { label: "B", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

const WITH_ZERO = {
  a: { label: "A", color: "chart-1", stack: "s" },
  z: { label: "Z", color: "chart-3", stack: "s" },
  b: { label: "B", color: "chart-2", stack: "s" },
} as const satisfies ChartConfig;

describe("metamorphic relations", () => {
  function chart(locale: SupportedLocale, scale: number, zero: boolean) {
    const rows = [
      { name: "x", a: 2 * scale, b: 3 * scale, z: 0 },
      { name: "y", a: 4 * scale, b: 1 * scale, z: 0 },
    ];
    const config: ChartConfig = zero ? WITH_ZERO : STACKED;
    return (
      <LocaleProvider locale={locale}>
        <div style={{ width: 300 }}>
          <Chart.Root data={rows} config={config} xKey="name" aria-label="Relasjoner">
            <Chart.YAxis />
            <Chart.Bar dataKey="a" />
            {zero ? <Chart.Bar dataKey="z" /> : null}
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("keeps the geometry when the locale changes", () => {
    const nb = boxes(renderThemed(chart("nb-NO", 1, false)).host);
    const en = boxes(renderThemed(chart("en-US", 1, false)).host);
    expect(en).toEqual(nb);
  });

  it("scales the value ticks with the data", () => {
    const ticks = (host: HTMLElement) =>
      // DOM audit: y ticks are aria-hidden text, so their slot is the only locator.
      [...host.querySelectorAll('[data-slot="chart-y-tick"]')].map((tick) =>
        Number(tick.textContent.replace(/[\s,]/gu, ""))
      );
    const one = ticks(renderThemed(chart("en-US", 1, false)).host);
    const thousand = ticks(renderThemed(chart("en-US", 1000, false)).host);
    expect(thousand).toEqual(one.map((tick) => tick * 1000));
  });

  it("moves no other mark when an all-zero series joins the stack", () => {
    const without = renderThemed(chart("nb-NO", 1, false)).host;
    const withZero = renderThemed(chart("nb-NO", 1, true)).host;
    expect(boxes(withZero, 0)).toEqual(boxes(without, 0));
    expect(boxes(withZero, 2)).toEqual(boxes(without, 1));
  });
});
