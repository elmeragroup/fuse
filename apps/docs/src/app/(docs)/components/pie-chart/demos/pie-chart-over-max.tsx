"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A month whose three highest hours average past the capacity step's 5 kWh limit.
const peaks = [{ measure: "peak", kwh: 5.6 }];

const config = {
  peak: {
    label: "Mean of the three highest hours",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function PieChartOverMax() {
  return (
    <PieChart.Root
      data={peaks}
      config={config}
      nameKey="measure"
      valueKey="kwh"
      max={5}
      startAngle={-135}
      endAngle={135}
      innerRadius={0.78}
      aria-label="Capacity step this month">
      <PieChart.Track />
      <PieChart.Pie cornerRadius={0.5} />
      <PieChart.Center>
        <PieChart.CenterValue />
        <PieChart.CenterLabel>
          of <PieChart.CenterMax />
        </PieChart.CenterLabel>
      </PieChart.Center>
      <PieChart.Tooltip />
    </PieChart.Root>
  );
}
