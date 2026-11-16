"use client";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A grid company's capacity tariff: the monthly fee for each step of the month's peak load, from
// the step's lower threshold in kW. The steps widen as the load grows.
const data = [
  { kw: 0, fee: 125 },
  { kw: 2, fee: 205 },
  { kw: 5, fee: 330 },
  { kw: 10, fee: 525 },
  { kw: 15, fee: 720 },
  { kw: 20, fee: 915 },
];

const config = {
  fee: {
    label: "Monthly fee",
    color: "chart-1",
    format: { style: "currency", currency: "NOK", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function AreaChartCapacityTariff() {
  return (
    <AreaChart.Root
      data={data}
      config={config}
      xKey="kw"
      xScale="linear"
      xFormat={{ preset: "power", unit: "kW", maximumFractionDigits: 0 }}
      xLabel="Peak load"
      xInclude={[25]}
      aria-label="Capacity tariff by peak load">
      <AreaChart.Grid />
      <AreaChart.YAxis />
      <AreaChart.XAxis label="Peak load" />
      <AreaChart.Area dataKey="fee" curve="step-after" />
      <AreaChart.Crosshair />
      <AreaChart.ActiveDot dataKey="fee" />
      <AreaChart.Tooltip />
    </AreaChart.Root>
  );
}
