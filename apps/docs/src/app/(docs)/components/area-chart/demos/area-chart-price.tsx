"use client";

import { AreaChart } from "@elmeragroup/fuse/chart";
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
    color: "chart-diverging",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "excluded" },
  },
} as const satisfies ChartConfig;

/**
 * A diverging scale paints the value: the fill and the line take the step of the price they pass,
 * so the negative hours stand apart, and the area fills up to 0 from below.
 */
export function AreaChartPrice() {
  return (
    <AreaChart.Root
      data={hours}
      config={config}
      xKey="hour"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Spot price today">
      <AreaChart.Grid />
      <AreaChart.YAxis />
      <AreaChart.XAxis />
      <AreaChart.Area
        dataKey="price"
        variant="solid"
        curve="step-after"
        style={{ "--chart-area-opacity": 0.35 }}
      />
      <AreaChart.Line dataKey="price" curve="step-after" />
      <AreaChart.Crosshair />
      <AreaChart.Tooltip />
      <AreaChart.Table />
    </AreaChart.Root>
  );
}
