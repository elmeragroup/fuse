"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

const ORE = [84.1, 82.6, 80.3, 79.9, 92.4, 101.7, 108.2, 112.5, 118.9, 121.3, 116.4, 109.8];

/** Twelve quarter hours from 16:00 in Oslo on 17 October 2026, which is UTC+2. */
const quarters = ORE.map((price, index) => ({
  start: new Date(Date.UTC(2026, 9, 17, 14, index * 15)),
  price,
}));

const config = {
  price: {
    label: "Spot price",
    color: "chart-1",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "included" },
  },
} as const satisfies ChartConfig;

export function LineChartSpotPrice() {
  return (
    <LineChart.Root
      data={quarters}
      config={config}
      xKey="start"
      interval="quarter-hour"
      timeZone="Europe/Oslo"
      now={new Date(Date.UTC(2026, 9, 17, 15, 20))}
      yBaseline="none"
      aria-label="Spot price this afternoon">
      <LineChart.Headline>
        <LineChart.ActiveValue dataKey="price" fallback="now" />
      </LineChart.Headline>
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis />
      <LineChart.Line dataKey="price" curve="step-after" />
      <LineChart.Marker dataKey="price" at="now" variant="halo" />
      <LineChart.Marker dataKey="price" at="max">
        <LineChart.ValueLabel />
      </LineChart.Marker>
      <LineChart.Crosshair />
      <LineChart.ActiveDot dataKey="price" />
      <LineChart.Tooltip />
      <LineChart.Table />
    </LineChart.Root>
  );
}
