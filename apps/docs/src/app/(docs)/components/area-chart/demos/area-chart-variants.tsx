"use client";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const data = [
  { month: "Jan", kwh: 2412 },
  { month: "Feb", kwh: 2168 },
  { month: "Mar", kwh: 1893 },
  { month: "Apr", kwh: 1447 },
  { month: "May", kwh: 1062 },
  { month: "Jun", kwh: 806 },
  { month: "Jul", kwh: 731 },
  { month: "Aug", kwh: 788 },
  { month: "Sep", kwh: 1004 },
  { month: "Oct", kwh: 1458 },
  { month: "Nov", kwh: 1917 },
  { month: "Dec", kwh: 2296 },
];

const config = {
  kwh: {
    label: "Consumption",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

const VARIANTS = ["gradient", "gradient-reverse", "solid", "dotted", "lines", "hatched"] as const;

/** Each fill look of `Chart.Area`, with a Line drawing its edge. */
export function AreaChartVariants() {
  return (
    <div className="sm:grid-cols-2 grid w-full gap-6">
      {VARIANTS.map((variant) => (
        <AreaChart.Root
          key={variant}
          data={data}
          config={config}
          xKey="month"
          xScale="point"
          style={{ "--chart-plot-height": "6rem", "--chart-area-opacity": 0.25 }}
          aria-label={`Consumption per month, ${variant} fill`}>
          <AreaChart.Area dataKey="kwh" variant={variant} />
          <AreaChart.Line dataKey="kwh" />
          <AreaChart.XAxis />
        </AreaChart.Root>
      ))}
    </div>
  );
}
