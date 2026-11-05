"use client";

import { PieChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The mean of this month's three highest hours so far, which sets the grid tariff's capacity step,
// against the step's upper limit of 5 kWh per hour.
const peaks = [{ measure: "peak", kwh: 3.9 }];

const config = {
  peak: {
    label: "Mean of the three highest hours",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 1 },
  },
} as const satisfies ChartConfig;

export function PieChartCapacityStep() {
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
        <PieChart.CenterValue format={{ maximumFractionDigits: 1 }} />
        <PieChart.CenterLabel>
          of <PieChart.CenterMax />
        </PieChart.CenterLabel>
      </PieChart.Center>
      <PieChart.Tooltip />
    </PieChart.Root>
  );
}
