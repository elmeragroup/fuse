"use client";

import { RadialChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Hourly peaks against the capacity step's limit of 5 kWh per hour.
const peaks = [
  { peak: "hour", kwh: 2.4 },
  { peak: "day", kwh: 3.6 },
  { peak: "month", kwh: 3.9 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  hour: { label: "This hour", color: "chart-1", format: energy },
  day: { label: "Today's peak", color: "chart-2", format: energy },
  month: { label: "Mean of the month's three highest hours", color: "chart-3", format: energy },
} as const satisfies ChartConfig;

export function RadialChartGauge() {
  return (
    <RadialChart.Root
      data={peaks}
      config={config}
      nameKey="peak"
      valueKey="kwh"
      max={5}
      startAngle={-135}
      endAngle={135}
      aria-label="Hourly peaks against the capacity step">
      <RadialChart.Track />
      <RadialChart.Bar />
      <RadialChart.Center>
        <RadialChart.CenterValue />
      </RadialChart.Center>
      <RadialChart.Table />
      <RadialChart.Tooltip />
    </RadialChart.Root>
  );
}
