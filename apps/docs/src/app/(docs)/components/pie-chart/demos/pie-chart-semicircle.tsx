"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One month's consumption split into the grid tariff's rate periods, in kilowatt-hours.
const periods = [
  { period: "day", kwh: 412 },
  { period: "night", kwh: 238 },
  { period: "weekend", kwh: 151 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  day: { label: "Day", color: "chart-1", format: energy },
  night: { label: "Night", color: "chart-2", format: energy },
  weekend: { label: "Weekend", color: "chart-3", format: energy },
} as const satisfies ChartConfig;

export function PieChartSemicircle() {
  return (
    <PieChart.Root
      data={periods}
      config={config}
      nameKey="period"
      valueKey="kwh"
      startAngle={-90}
      endAngle={90}
      innerRadius={0.55}
      padAngle={1}
      aria-label="Consumption per rate period in October">
      <PieChart.Pie />
      <PieChart.Labels position="inside">
        <PieChart.LegendShare />
      </PieChart.Labels>
      <PieChart.Center>
        <PieChart.CenterValue />
      </PieChart.Center>
      <PieChart.Legend />
      <PieChart.Tooltip />
    </PieChart.Root>
  );
}
