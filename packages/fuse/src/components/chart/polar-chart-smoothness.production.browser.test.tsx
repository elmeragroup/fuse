// The polar smoothness judge, in Chromium with React's production build, as
// `chart-smoothness.production.browser.test.tsx` judges the cartesian marks. Units under test: a
// 32-slice pie, a 24-spoke radar of two series, a 168-slot week dial and an 8,760-slot year dial
// whose every other hour is estimated, drawn as a step-after Area and Line (r4 Q1), its hatch by
// pixel column (Phase M), each through its entrance and through a data update. Oracle: SPEC's L8 long-task check and motion-decision.md "Judges", no
// long task over 50 ms from the mount's first frame to the entrance's end, nor through an update's
// commit and its 480 ms tween. vitest.config.ts runs this project alone, after every other one.
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";

/** 1 January 2025 in Oslo, the year's first hour. 2025 holds 8,760 hours. */
const NEW_YEAR = Date.parse("2024-12-31T23:00:00Z");

/** A sawtooth from 1 to 7 at an index, shifted per update. */
function tooth(index: number, shift: number): number {
  return 1 + ((index + shift) % 7);
}

/** Monday 20 October 2025 in Oslo, the week's first hour. */
const MONDAY = Date.parse("2025-10-19T22:00:00Z");

function Pie32({ phase }: { readonly phase: number }): ReactElement {
  const keys = Array.from({ length: 32 }, (_, index) => `p${String(index)}`);
  return (
    <PieChart.Root
      data={keys.map((part, index) => ({ part, kr: tooth(index, phase) }))}
      config={Object.fromEntries(keys.map((key) => [key, { label: key, color: "chart-1" }]))}
      nameKey="part"
      valueKey="kr"
      maxSlices={32}
      innerRadius={0.5}
      aria-label="32 slices">
      <PieChart.Pie />
      <PieChart.Labels position="outside" />
    </PieChart.Root>
  );
}

function Radar24({ phase }: { readonly phase: number }): ReactElement {
  return (
    <RadarChart.Root
      data={Array.from({ length: 24 }, (_, index) => ({
        spoke: `s${String(index)}`,
        NO1: tooth(index, phase),
        NO2: tooth(index, phase + 3),
      }))}
      config={{ NO1: { label: "NO1", color: "chart-1" }, NO2: { label: "NO2", color: "chart-2" } }}
      nameKey="spoke"
      aria-label="24 spokes">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.Area dataKey="NO1" />
      <RadarChart.Line dataKey="NO2" />
      <RadarChart.Dots dataKey="NO2" />
    </RadarChart.Root>
  );
}

function Week168({ phase }: { readonly phase: number }): ReactElement {
  return (
    <ClockChart.Root
      data={Array.from({ length: 168 }, (_, hour) => ({
        start: MONDAY + hour * 3_600_000,
        kwh: tooth(hour, phase),
      }))}
      config={{ kwh: { label: "kWh", color: "chart-1" } }}
      xKey="start"
      cycle="week"
      interval="hour"
      aria-label="168 hours">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Column dataKey="kwh" />
      <ClockChart.Line dataKey="kwh" />
    </ClockChart.Root>
  );
}

function Year8760({ phase }: { readonly phase: number }): ReactElement {
  return (
    <ClockChart.Root
      data={Array.from({ length: 8760 }, (_, hour) => ({
        start: NEW_YEAR + hour * 3_600_000,
        kwh: tooth(hour, phase),
        q: hour % 2 === 1 ? ("estimated" as const) : ("measured" as const),
      }))}
      config={{ kwh: { label: "kWh", color: "chart-1", qualityKey: "q" } }}
      xKey="start"
      cycle="year"
      interval="hour"
      aria-label="8 760 hours">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Area dataKey="kwh" curve="step-after" />
      <ClockChart.Line dataKey="kwh" curve="step-after" />
    </ClockChart.Root>
  );
}

/** The subpaths every path in a slot's layers draws, one per M. */
function subpaths(host: HTMLElement, selector: string): number {
  // DOM audit: polar marks are aria-hidden plot output, read by their slot.
  return [...host.querySelectorAll(selector)].reduce(
    (count, path) => count + ((path.getAttribute("d") ?? "").match(/M/gu) ?? []).length,
    0
  );
}

/** Each chart, and how many of its items it draws, so the judge times the full count. */
const CASES = [
  {
    name: "a 32-slice pie",
    Chart: Pie32,
    items: (host: HTMLElement) => subpaths(host, '[data-slot="pie-chart-sector"]'),
    count: 32,
  },
  {
    name: "a 24-spoke radar",
    Chart: Radar24,
    // DOM audit: the spokes are aria-hidden plot output, read by their slot; the hand is a part.
    items: (host: HTMLElement) =>
      host.querySelectorAll('[data-slot="radar-chart-spoke"]:not([data-part])').length,
    count: 24,
  },
  {
    name: "a 168-slot week dial",
    Chart: Week168,
    items: (host: HTMLElement) => subpaths(host, '[data-slot="clock-chart-column"] path'),
    count: 168,
  },
  {
    name: "an 8,760-slot year dial with every other hour estimated",
    Chart: Year8760,
    // The odd hours' dashes, each its own piece across its own slot.
    items: (host: HTMLElement) => subpaths(host, '[data-slot="clock-chart-line-path"][data-part="marked"]'),
    count: 4380,
  },
] as const;

/** Wait out `ms` of frames from now. */
async function frames(ms: number): Promise<void> {
  const from = performance.now();
  while (performance.now() - from < ms) await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("polar smoothness", () => {
  it.each(CASES)(
    "draws $name's entrance and an update with no long task over 50 ms",
    async ({ Chart, items, count }) => {
      const shown = (phase: number) => (
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <div style={{ width: 728 }}>
            <Chart phase={phase} />
          </div>
        </LocaleProvider>
      );
      const long: number[] = [];
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) long.push(entry.duration);
      });
      const { host, rerender } = renderThemed(shown(0));
      // The mount's own rendering task ends a frame later, so the observer starts after it.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      observer.observe({ entryTypes: ["longtask"] });
      // The entrance plays once the chart is in view: at most 1.25 s, after the radar's 600 ms wait
      // and the pie's 31 staggered slices, 100 + 31 · 80 + 1,000 ms.
      await frames(3700);
      expect(polarFigure(host).hasAttribute("data-entering")).toBe(false);
      expect(items(host)).toBe(count);
      rerender(shown(3));
      await frames(560);
      observer.disconnect();
      expect(long.filter((duration) => duration > 50)).toEqual([]);
    }
  );
});
