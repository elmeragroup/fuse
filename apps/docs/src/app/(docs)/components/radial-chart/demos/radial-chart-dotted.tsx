"use client";

import { RadialChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Yesterday's consumption in each part of the day against its daily target, in kilowatt-hours.
const day = [
  { part: "morning", kwh: 9.2, target: 12 },
  { part: "daytime", kwh: 6.1, target: 10 },
  { part: "evening", kwh: 11.4, target: 14 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  morning: { label: "Morning", color: "chart-1", format: energy },
  daytime: { label: "Daytime", color: "chart-2", format: energy },
  evening: { label: "Evening", color: "chart-3", format: energy },
} as const satisfies ChartConfig;

export function RadialChartDotted() {
  return (
    <RadialChart.Root
      data={day}
      config={config}
      nameKey="part"
      valueKey="kwh"
      maxKey="target"
      aria-label="Yesterday against the daily targets">
      <RadialChart.Bar variant="dotted" />
      <RadialChart.Legend />
      <RadialChart.Tooltip />
    </RadialChart.Root>
  );
}
