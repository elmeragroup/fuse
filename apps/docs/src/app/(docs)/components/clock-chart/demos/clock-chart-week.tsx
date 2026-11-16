"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's consumption per day in the ISO week from Monday 12 October 2026, in kWh.
const KWH = [36.9, 36.4, 35.1, 35.6, 37.1, 41.8, 43.5];

// Monday 12 October 2026 starts at 22:00 UTC on the 11th, since Oslo is on summer time.
const days = KWH.map((kwh, day) => ({ start: new Date(Date.UTC(2026, 9, 11 + day, 22)), kwh }));

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function ClockChartWeek() {
  return (
    <ClockChart.Root
      data={days}
      config={config}
      xKey="start"
      cycle="week"
      interval="day"
      timeZone="Europe/Oslo"
      aria-label="A household's consumption per day, week 42 of 2026">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.RadiusAxis />
      <ClockChart.Column dataKey="kwh" />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
