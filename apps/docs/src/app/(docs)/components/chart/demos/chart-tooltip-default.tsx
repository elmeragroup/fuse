"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's consumption per month, split into the grid tariff's day and night rate periods.
const data = [
  { month: "Jan", day: 1531, night: 881 },
  { month: "Feb", day: 1384, night: 784 },
  { month: "Mar", day: 1220, night: 673 },
  { month: "Apr", day: 948, night: 499 },
  { month: "May", day: 712, night: 350 },
  { month: "Jun", day: 547, night: 259 },
  { month: "Jul", day: 499, night: 232 },
  { month: "Aug", day: 535, night: 253 },
  { month: "Sep", day: 676, night: 328 },
  { month: "Oct", day: 961, night: 497 },
  { month: "Nov", day: 1229, night: 688 },
  { month: "Dec", day: 1458, night: 838 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 0 } as const;

const config = {
  day: { label: "Day", color: "chart-1", format: energy },
  night: { label: "Night", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function ChartTooltipDefault() {
  return (
    <Chart.Root
      data={data}
      config={config}
      xKey="month"
      defaultActiveX="May"
      aria-label="Day and night consumption per month">
      <Chart.Grid variant="dashed" />
      <Chart.XAxis />
      <Chart.BarGroup series={["day", "night"]}>
        <Chart.Bar dataKey="day" />
        <Chart.Bar dataKey="night" />
      </Chart.BarGroup>
      <Chart.Legend />
      <Chart.Tooltip />
      <Chart.Table />
    </Chart.Root>
  );
}
