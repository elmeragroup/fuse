"use client";

import { LineChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Spot price in NO2 on a windy day, in øre per kWh, which dips below zero around noon.
const ORE = [
  21.4, 18.9, 15.2, 12.8, 9.6, 6.1, 2.4, -1.8, -4.2, -6.9, -8.3, -7.1, -3.4, 1.9, 6.8, 12.5, 18.2, 24.7, 31.3,
  28.9, 24.1, 19.6, 16.2, 13.8,
];

/** One row per hour from 00:00 in Oslo on 7 June 2026, which is UTC+2. */
const hours = ORE.map((price, index) => ({ hour: new Date(Date.UTC(2026, 5, 6, 22 + index)), price }));

const config = {
  price: {
    label: "Spot price",
    color: "chart-1",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "excluded" },
  },
} as const satisfies ChartConfig;

export function LineChartMarkers() {
  return (
    <LineChart.Root
      data={hours}
      config={config}
      xKey="hour"
      interval="hour"
      timeZone="Europe/Oslo"
      now={new Date(Date.UTC(2026, 5, 7, 13, 20))}
      yBaseline="none"
      aria-label="Spot price today">
      <LineChart.Grid />
      <LineChart.YAxis />
      <LineChart.XAxis />
      <LineChart.ReferenceLine y={0} />
      <LineChart.Line dataKey="price" curve="step-after" />
      <LineChart.Marker dataKey="price" at="min">
        <LineChart.ValueLabel />
      </LineChart.Marker>
      <LineChart.Marker dataKey="price" at="now" variant="ping" />
      <LineChart.Crosshair />
      <LineChart.ActiveDot dataKey="price" variant="halo" />
      <LineChart.Tooltip />
      <LineChart.Table />
    </LineChart.Root>
  );
}
