// The React cost of a pointer on each polar family, in Chromium. Units under test: PieChart,
// RadialChart, RadarChart and ClockChart Roots with their marks and followers. Oracle: SPEC's L8
// check and CONTRACT section 4, a pointer move commits nothing: the Root writes the active option
// onto the figure and each follower paints from the store, so a 240-step sweep that crosses every
// option renders the Root and its parts 0 times. The counts come from React's Profiler.
import { Profiler } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import { nextFrames } from "../../../test/animation-frames";
import { activeSlice, clientPoint, dialPoint, hoverAt, polarFigure } from "../../../test/chart/pie";
import { renderThemed } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import "./chart.css";
import { ClockChart } from "./clock-chart-namespace";
import { PieChart } from "./pie-chart-namespace";
import { RadarChart } from "./radar-chart-namespace";
import { RadialChart } from "./radial-chart-namespace";

/** Six parts of a bill, in kroner. */
const BILL = [
  { part: "energi", kr: 412 },
  { part: "nettleie", kr: 268 },
  { part: "avgift", kr: 154 },
  { part: "mva", kr: 96 },
  { part: "fastledd", kr: 49 },
  { part: "paslag", kr: 21 },
];

const BILL_CONFIG = {
  energi: { label: "Energi", color: "chart-1" },
  nettleie: { label: "Nettleie", color: "chart-2" },
  avgift: { label: "Avgift", color: "chart-3" },
  mva: { label: "Mva", color: "chart-4" },
  fastledd: { label: "Fastledd", color: "chart-5" },
  paslag: { label: "Påslag", color: "chart-6" },
} as const;

/** Midnight in Oslo on 25 October 2025, a 24-hour day. */
const DAY = Date.parse("2025-10-24T22:00:00Z");

/** Each family's chart of marks and followers, the dial radius its sweep runs along, and its options. */
const FAMILIES = [
  {
    family: "pie",
    radius: 0.75,
    options: 6,
    chart: (
      <PieChart.Root
        data={BILL}
        config={BILL_CONFIG}
        nameKey="part"
        valueKey="kr"
        innerRadius={0.5}
        aria-label="Regning">
        <PieChart.Track />
        <PieChart.Pie />
        <PieChart.Glow dataKey="energi" />
        <PieChart.Labels position="outside" />
      </PieChart.Root>
    ),
  },
  {
    family: "radial",
    radius: null,
    options: 6,
    chart: (
      <RadialChart.Root
        data={BILL}
        config={BILL_CONFIG}
        nameKey="part"
        valueKey="kr"
        max={500}
        aria-label="Ringer">
        <RadialChart.Track />
        <RadialChart.Bar />
        <RadialChart.Glow dataKey="energi" />
      </RadialChart.Root>
    ),
  },
  {
    family: "radar",
    radius: 0.7,
    options: 6,
    chart: (
      <RadarChart.Root
        data={BILL.map(({ part, kr }) => ({ part, NO1: kr, NO2: kr * 0.8 }))}
        config={{ NO1: { label: "NO1", color: "chart-1" }, NO2: { label: "NO2", color: "chart-2" } }}
        nameKey="part"
        aria-label="Radar">
        <RadarChart.Grid />
        <RadarChart.AngleAxis />
        <RadarChart.Area dataKey="NO1" />
        <RadarChart.Line dataKey="NO2" />
        <RadarChart.Dots dataKey="NO2" />
        <RadarChart.ActiveDot dataKey="NO1" />
      </RadarChart.Root>
    ),
  },
  {
    family: "clock",
    radius: 0.7,
    options: 24,
    chart: (
      <ClockChart.Root
        data={Array.from({ length: 24 }, (_, hour) => ({
          start: DAY + hour * 3_600_000,
          kwh: 1 + (hour % 5),
        }))}
        config={{ kwh: { label: "kWh", color: "chart-1" } }}
        xKey="start"
        cycle="day"
        interval="hour"
        aria-label="Døgn">
        <ClockChart.Grid />
        <ClockChart.AngleAxis />
        <ClockChart.Column dataKey="kwh" />
        <ClockChart.Line dataKey="kwh" />
        <ClockChart.ActiveDot dataKey="kwh" />
        <ClockChart.Scrubber />
      </ClockChart.Root>
    ),
  },
] as const;

describe("a pointer on a polar chart (SPEC's L8 pointer cost)", () => {
  it.each(FAMILIES)(
    "commits nothing while the pointer sweeps a $family chart",
    async ({ chart, radius, options }) => {
      let commits = 0;
      const { host } = renderThemed(
        <LocaleProvider locale="nb-NO" timeZone="Europe/Oslo">
          <div style={{ width: 320 }}>
            <Profiler
              id="chart"
              onRender={(_, phase) => {
                if (phase !== "mount") commits += 1;
              }}>
              {chart}
            </Profiler>
          </div>
        </LocaleProvider>
      );
      await nextFrames(1);
      commits = 0;
      // DOM audit: every polar layer is aria-hidden plot output in the dial's units.
      const layer = polarFigure(host).querySelector<SVGSVGElement>("svg[data-polar-layer]");
      if (layer === null) throw new Error("no polar layer");
      const seen = new Set<number>();
      for (let step = 0; step < 240; step += 1) {
        // A ring chart picks by radius, so its sweep runs out from the hole; the rest turn once round.
        const point =
          radius === null
            ? dialPoint(45, 0.2 + (0.8 * step) / 239)
            : dialPoint((360 * (step + 0.5)) / 240, radius);
        const [x, y] = clientPoint(layer, point.x, point.y);
        await hoverAt(x, y);
        const active = activeSlice(host);
        if (active !== null) seen.add(active);
      }
      // The sweep crossed every option, and React committed nothing.
      expect(seen.size).toBe(options);
      expect(commits).toBe(0);
    }
  );
});
