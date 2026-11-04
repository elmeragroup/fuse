"use client";

import { AreaChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Spot price in NO1 in kr per kWh with VAT. Wednesday 4 and Thursday 5 November 2026 are known
// hour by hour. From Friday the forecast holds one price per 4-hour block, for five days.
const KNOWN = [
  0.48, 0.46, 0.47, 0.44, 0.42, 0.47, 0.55, 0.66, 0.73, 0.7, 0.64, 0.6, 0.57, 0.57, 0.62, 0.68, 0.78, 0.86,
  0.8, 0.72, 0.66, 0.61, 0.55, 0.5, 0.47, 0.45, 0.43, 0.42, 0.42, 0.48, 0.58, 0.69, 0.77, 0.73, 0.67, 0.63,
  0.6, 0.61, 0.65, 0.72, 0.8, 0.78, 0.71, 0.66, 0.62, 0.57, 0.53, 0.5,
];
const FORECAST_BLOCKS = [
  0.52, 0.64, 0.79, 0.68, 0.85, 0.65, 0.44, 0.53, 0.69, 0.59, 0.72, 0.56, 0.51, 0.63, 0.8, 0.67, 0.86, 0.65,
  0.62, 0.75, 0.9, 0.8, 1, 0.78, 0.55, 0.68, 0.83, 0.74, 0.91, 0.7,
];
const prices = [...KNOWN, ...FORECAST_BLOCKS.flatMap((price) => [price, price, price, price])];

/** One row per hour from 00:00 in Oslo on 4 November 2026, which is UTC+1. */
const hours = prices.map((price, index) => ({ hour: new Date(Date.UTC(2026, 10, 3, 23 + index)), price }));

/** Friday 00:00 in Oslo, where the forecast starts. */
const forecastFrom = new Date(Date.UTC(2026, 10, 5, 23));

/** The week's average, which splits the colours and draws the reference line. */
const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;

const format = { preset: "unit-price", currency: "NOK", vat: "included" } as const;

const config = {
  price: {
    label: "Spot price",
    color: {
      threshold: average,
      below: { color: "chart-sentiment-positive", label: "Below average" },
      above: { color: "chart-sentiment-negative", label: "Above average" },
    },
    format,
    projectedFrom: forecastFrom,
  },
} as const satisfies ChartConfig;

/**
 * A threshold colour paints the price above the week's average in one role and below it in
 * another. The line and the fill change colour where they cross the dashed average, and the legend
 * names both sides.
 */
export function AreaChartThreshold() {
  return (
    <AreaChart.Root
      data={hours}
      config={config}
      xKey="hour"
      interval="hour"
      timeZone="Europe/Oslo"
      now={new Date(Date.UTC(2026, 10, 4, 7, 20))}
      aria-label="Spot price this week, with the forecast from Friday">
      <AreaChart.Headline>
        <AreaChart.ActiveValue dataKey="price" fallback="now" />
        <span>This hour, or the hour you point at</span>
      </AreaChart.Headline>
      <AreaChart.Grid />
      <AreaChart.YAxis />
      <AreaChart.XAxis />
      <AreaChart.ReferenceArea
        x1={forecastFrom}
        x2={hours.at(-1)?.hour ?? forecastFrom}
        label="Forecast"
        tone="muted"
      />
      <AreaChart.ReferenceLine y={average} label="Average" variant="dashed" tone="muted" />
      <AreaChart.Area dataKey="price" variant="solid" curve="step-after" />
      <AreaChart.Line dataKey="price" curve="step-after" />
      <AreaChart.Marker dataKey="price" at="now" />
      <AreaChart.Crosshair />
      <AreaChart.ActiveDot dataKey="price" />
      <AreaChart.Tooltip />
      <AreaChart.Legend />
      <AreaChart.Table />
    </AreaChart.Root>
  );
}
