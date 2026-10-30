// Bar layout judges in Chromium. Oracles: section 8.15's hand-derived band of
// 40 px with 14 px grouped bars at 5 and 21 px, section 8.12's structural counts per form, section
// 8.14's plot heights, section 8.10's tie fixture, and metamorphic relations: a locale change
// leaves geometry unchanged, scaling the data scales the ticks, and an all-zero series added to a
// stack moves no other mark.
import { useLayoutEffect, useState } from "react";
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

function boxes(host: HTMLElement, series?: number): BarBox[] {
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
            data-intro="none"
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

  it("takes a BarGroup's own 10 px bar gap: 10 px bars at 5 and 25 px of each 40 px band", () => {
    // Each 40 px band keeps 30 px inside its 25 % gap, from 5 px. Two bars and one 10 px gap split
    // it into 10 px bars at 5 and 25 px, and at 45 and 65 px in the second band.
    const { host } = renderThemed(
      two(
        <Chart.BarGroup series={["a", "b"]} style={{ "--chart-bar-gap": "10px" }}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      )
    );
    const edges = [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    expect(edges).toHaveLength(8);
    [5, 15, 45, 55, 25, 35, 65, 75].forEach((edge, index) => near(edges[index] ?? 0, edge));
  });

  it("keeps a 20 px bar gap that leaves the bars width: 5 px bars at 5 and 30 px of each 40 px band", () => {
    // Q7-3: 30 px inside each band's 25 % gap, less one 20 px gap, leaves two 5 px bars. The gap
    // stays as asked, so the bars sit at 5 and 30 px, and at 45 and 70 px in the second band.
    const { host } = renderThemed(
      two(
        <Chart.BarGroup series={["a", "b"]} style={{ "--chart-bar-gap": "20px" }}>
          <Chart.Bar dataKey="a" />
          <Chart.Bar dataKey="b" />
        </Chart.BarGroup>
      )
    );
    const edges = [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    expect(edges).toHaveLength(8);
    [5, 10, 45, 50, 30, 35, 70, 75].forEach((edge, index) => near(edges[index] ?? 0, edge));
  });

  it("redraws memoized bars when only the group's own spacing changes", async () => {
    // B2-2: the group's gap grows from 2 to 10 px while its Bars skip rendering. 14 px bars at 5
    // and 21 px become 10 px bars at 5 and 25 px, as the 30 px inside each band splits anew.
    const control = { widen: (): void => undefined };
    function Group({ children }: { readonly children: ReactNode }) {
      const [gap, setGap] = useState("2px");
      useLayoutEffect(() => {
        control.widen = () => {
          setGap("10px");
        };
      });
      return (
        <Chart.BarGroup series={["a", "b"]} style={{ "--chart-bar-gap": gap }}>
          {children}
        </Chart.BarGroup>
      );
    }
    // One element for the Bars, so the group's renders hand React the same children to skip.
    const members = (
      <>
        <Chart.Bar dataKey="a" />
        <Chart.Bar dataKey="b" />
      </>
    );
    const { host } = renderThemed(two(<Group>{members}</Group>));
    const edges = () => [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    [5, 19, 45, 59, 21, 35, 61, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
    control.widen();
    await expect.poll(() => Math.round(edges()[1] ?? 0)).toBe(15);
    [5, 15, 45, 55, 25, 35, 65, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
  });

  it("redraws a group that never renders again when Root's own spacing changes", async () => {
    // B3-3: Root's gap grows from 2 to 10 px while the group's element stays the same. The bars
    // become 10 px wide at 5 and 25 px of each 40 px band.
    const group = (
      <Chart.BarGroup series={["a", "b"]}>
        <Chart.Bar dataKey="a" />
        <Chart.Bar dataKey="b" />
      </Chart.BarGroup>
    );
    // The same rows on every render, so only Root's style changes.
    const rows = [
      { name: "x", a: 4, b: 2 },
      { name: "y", a: 3, b: 1 },
    ];
    const chart = (gap: string) => (
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 80 }}>
          <Chart.Root
            data-intro="none"
            data={rows}
            config={TWO}
            xKey="name"
            style={{ "--chart-bar-gap": gap }}
            aria-label="To">
            {group}
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    const { host, rerender } = renderThemed(chart("2px"));
    const edges = () => [...boxes(host, 0), ...boxes(host, 1)].flatMap(({ left, right }) => [left, right]);
    [5, 19, 45, 59, 21, 35, 61, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
    rerender(chart("10px"));
    await expect.poll(() => Math.round(edges()[1] ?? 0)).toBe(15);
    [5, 15, 45, 55, 25, 35, 65, 75].forEach((edge, index) => near(edges()[index] ?? 0, edge));
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

describe("bars denser than the device pixels", () => {
  it("keeps one device pixel for every bar of 100 categories in two series on a 400 px plot", async () => {
    // B2-1 at DPR 1: each 4 px band keeps 3 px inside its 25 % gap, and two bars 2 px apart get
    // 0.5 px each, from 4i + 0.5 and 4i + 3. The first snaps to [4i, 4i + 1], and the second,
    // whose edges both snap to 4i + 3, keeps one pixel to 4i + 4.
    expect(devicePixelRatio).toBe(1);
    const rows = Array.from({ length: 100 }, (_, index) => ({ name: `c${String(index)}`, a: 2, b: 3 }));
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root data-intro="none" data={rows} config={TWO} xKey="name" aria-label="Tett">
            <Chart.BarGroup series={["a", "b"]}>
              <Chart.Bar dataKey="a" />
              <Chart.Bar dataKey="b" />
            </Chart.BarGroup>
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    expect(plotOf(host).width).toBe(400);
    for (const series of [0, 1]) {
      const drawn = boxes(host, series);
      expect(drawn).toHaveLength(100);
      drawn.forEach(({ left, right }, index) => {
        near(left, 4 * index + (series === 0 ? 0 : 3));
        near(right - left, 1);
      });
    }
    // The active overlay draws the same rectangle over the second slot.
    // DOM audit: the plot's single tab stop is the listbox's option.
    host.querySelector<HTMLElement>('[role="option"]')?.focus();
    await userEvent.keyboard("{ArrowRight}");
    // DOM audit: the overlays are aria-hidden plot output.
    const overlays = [...host.querySelectorAll('[data-slot="chart-bar-active"]')];
    expect(
      overlays.map((overlay) => [overlay.getAttribute("visibility"), overlay.getAttribute("width")])
    ).toEqual([
      ["visible", "1"],
      ["visible", "1"],
    ]);
  });
});

describe("structural counts per form", () => {
  function quarters(rows: readonly { readonly time_start: string; readonly SEK_per_kWh: number }[]) {
    return (
      <LocaleProvider locale="sv-SE">
        <Chart.Root
          data-intro="none"
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
          data-intro="none"
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
          <Chart.Root
            data-intro="none"
            data={[{ name: "x", a: 1, b: 1 }]}
            config={TWO}
            xKey="name"
            aria-label="Høyde">
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
        <Chart.Root
          data-intro="none"
          data={rows}
          config={TWO}
          xKey="name"
          orientation="horizontal"
          aria-label="Rader">
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
        <Chart.Root
          data-intro="none"
          data={rows}
          config={TWO}
          xKey="name"
          orientation="horizontal"
          aria-label="Rader">
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
        <Chart.Root data-intro="none" data={rows} config={TWO} xKey="name" aria-label="Uthevet">
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
          data-intro="none"
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
          <Chart.Root data-intro="none" data={rows} config={config} xKey="name" aria-label="Relasjoner">
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

describe("bars in measured pixels", () => {
  /** Each box rounded to the half pixel, the most a snap to the device pixel grid moves an edge. */
  function expectBoxes(actual: readonly BarBox[], wanted: readonly BarBox[]): void {
    expect(actual).toHaveLength(wanted.length);
    actual.forEach((box, index) => {
      for (const edge of ["left", "right", "top", "bottom"] as const)
        near(box[edge], wanted[index]?.[edge] ?? Number.NaN);
    });
  }

  function stacked(width: number) {
    return (
      <LocaleProvider locale="nb-NO">
        <div style={{ width }}>
          <Chart.Root
            data-intro="none"
            data={[
              { name: "x", a: 3, b: 5 },
              { name: "y", a: 2, b: 2 },
            ]}
            config={STACKED}
            xKey="name"
            aria-label="Stablet">
            <Chart.Bar dataKey="a" />
            <Chart.Bar dataKey="b" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
  }

  it("draws a stacked chart on a 400 × 200 plot where the hand-worked pixels say", () => {
    // Totals 8 and 4 on [0, 8] give 25 px per unit down a 200 px plot. Each 200 px band keeps its
    // middle 150 px. a's inner segment ends a 2 px seam below b, which tops its stack.
    const { host } = renderThemed(stacked(400));
    expectBoxes(boxes(host, 0), [
      { left: 25, right: 175, top: 127, bottom: 200 },
      { left: 225, right: 375, top: 152, bottom: 200 },
    ]);
    expectBoxes(boxes(host, 1), [
      { left: 25, right: 175, top: 0, bottom: 125 },
      { left: 225, right: 375, top: 100, bottom: 150 },
    ]);
  });

  it("redraws the bars at a new width once the plot resizes", async () => {
    // At 300 px each band is 150 px, so its bar keeps 18.75 to 131.25 px of it.
    const { host } = renderThemed(stacked(400));
    const frame = host.querySelector<HTMLElement>('[data-slot="chart"]')?.parentElement;
    frame?.style.setProperty("width", "300px");
    await expect
      .poll(() => Math.round(boxes(host, 1)[1]?.right ?? 0), { timeout: 2000 })
      .toBe(Math.round(281.25));
    expectBoxes(boxes(host, 1), [
      { left: 18.75, right: 131.25, top: 0, bottom: 125 },
      { left: 168.75, right: 281.25, top: 100, bottom: 150 },
    ]);
  });

  it("draws horizontal bars on 32 px rows from the zero line to the right", () => {
    // Values 6 and 3 on [0, 6] across a 400 px plot, and each 32 px row keeps its middle 24 px.
    const { host } = renderThemed(
      <LocaleProvider locale="nb-NO">
        <div style={{ width: 400 }}>
          <Chart.Root
            data-intro="none"
            data={[
              { name: "a", a: 6, b: 1 },
              { name: "b", a: 3, b: 1 },
            ]}
            config={TWO}
            xKey="name"
            orientation="horizontal"
            aria-label="Rader">
            <Chart.Bar dataKey="a" />
          </Chart.Root>
        </div>
      </LocaleProvider>
    );
    expectBoxes(boxes(host), [
      { left: 0, right: 400, top: 4, bottom: 28 },
      { left: 0, right: 200, top: 36, bottom: 60 },
    ]);
  });
});
