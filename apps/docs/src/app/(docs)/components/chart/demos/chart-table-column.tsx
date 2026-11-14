"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// One household's usage per month in the first half of 2026, with the change from the same month
// of 2025 as a share.
const months = [
  { month: "Jan", kwh: 2587, change: 0.073 },
  { month: "Feb", kwh: 2041, change: -0.059 },
  { month: "Mar", kwh: 1822, change: -0.038 },
  { month: "Apr", kwh: 1392, change: -0.038 },
  { month: "May", kwh: 1104, change: 0.04 },
  { month: "Jun", kwh: 779, change: -0.034 },
];

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ChartTableColumn() {
  return (
    <Chart.Root data={months} config={config} xKey="month" aria-label="Usage per month, January to June 2026">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip />
      <Chart.Table>
        <Chart.TableColumn
          dataKey="change"
          header="Change from 2025"
          format={{ style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" }}
        />
      </Chart.Table>
    </Chart.Root>
  );
}
