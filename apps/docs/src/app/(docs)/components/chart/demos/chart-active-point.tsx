"use client";

import { Chart, formatChartValue, useChartPoint } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { useLocale } from "@elmeragroup/fuse/theme";

/** Twelve hours from midnight in Oslo on 17 October 2026, which is UTC+2. */
const hours = [0.42, 0.38, 0.35, 0.34, 0.36, 0.51, 0.88, 1.24, 1.02, 0.74, 0.66, 0.61].map((kwh, index) => ({
  start: new Date(Date.UTC(2026, 9, 16, 22 + index)),
  kwh,
}));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** An illustrative flat price in NOK per kWh, typed by hand. */
const PRICE = 1.25;

/** The active hour's cost, read from the chart's active point. */
function HourCost() {
  const point = useChartPoint();
  const { locale } = useLocale();
  const kwh = point?.values.kwh;
  if (kwh === null || kwh === undefined) return null;
  const cost = formatChartValue(kwh * PRICE, { style: "currency", currency: "NOK" }, { locale });
  return <p className="text-xs text-muted-foreground">Cost {cost.text}</p>;
}

export function ChartActivePoint() {
  return (
    <Chart.Root
      data={hours}
      config={config}
      xKey="start"
      defaultActiveX={new Date(Date.UTC(2026, 9, 17, 5))}
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Usage per hour, 17 October">
      <Chart.Grid />
      <Chart.YAxis />
      <Chart.XAxis />
      <Chart.Bar dataKey="kwh" />
      <Chart.Tooltip>
        <Chart.TooltipLabel />
        <Chart.TooltipItems />
        <HourCost />
      </Chart.Tooltip>
      <Chart.Table />
    </Chart.Root>
  );
}
