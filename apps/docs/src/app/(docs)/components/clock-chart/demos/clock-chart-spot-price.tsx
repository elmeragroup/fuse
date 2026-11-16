"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

/** An NO1 spot price per hour, in øre/kWh, for a sunny summer Sunday, its midday hours below zero. */
const ORE = [
  48.2, 44.6, 41.9, 40.3, 41.7, 46.8, 55.4, 63.1, 58.7, 36.2, 12.4, -2.8, -6.5, -8.9, -7.4, -4.1, -1.6, 9.8,
  41.5, 72.9, 81.6, 77.3, 66.8, 57.2,
];

/** The 24 hours from midnight in Oslo on 14 June 2026, which is UTC+2. */
const hours = ORE.map((ore, hour) => ({ start: new Date(Date.UTC(2026, 5, 13, 22 + hour)), ore }));

const average = hours.reduce((sum, { ore }) => sum + ore, 0) / hours.length;

const config = {
  ore: {
    label: "Spot price",
    format: { preset: "unit-price", currency: "NOK", minor: true, vat: "excluded", maximumFractionDigits: 1 },
    color: {
      threshold: average,
      below: { color: "chart-sentiment-positive", label: "Below the day's average" },
      above: { color: "chart-sentiment-negative", label: "Above the day's average" },
    },
  },
} as const satisfies ChartConfig;

export function ClockChartSpotPrice() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="day"
      interval="hour"
      timeZone="Europe/Oslo"
      radiusScale="linear"
      aria-label="NO1 spot price per hour, 14 June 2026">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.RadiusAxis />
      <ClockChart.Column dataKey="ore" />
      <ClockChart.ReferenceLine y={average} variant="dashed" />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
