"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// The 25 hours of the fall-back day 26 October 2025 in Oslo. `kwh` is NO1 household consumption
// per metering point, from the Elhub dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no,
// licensed under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. `price` is the hour's mean
// of an invented spot price in SEK per kWh, typed by hand, so it carries no market data.
const hours = [
  { start: "2025-10-26T00:00:00+02:00", kwh: 1.405, price: 0.425 },
  { start: "2025-10-26T01:00:00+02:00", kwh: 1.335, price: 0.385 },
  { start: "2025-10-26T02:00:00+02:00", kwh: 1.283, price: 0.355 },
  { start: "2025-10-26T02:00:00+01:00", kwh: 1.247, price: 0.335 },
  { start: "2025-10-26T03:00:00+01:00", kwh: 1.23, price: 0.315 },
  { start: "2025-10-26T04:00:00+01:00", kwh: 1.228, price: 0.305 },
  { start: "2025-10-26T05:00:00+01:00", kwh: 1.238, price: 0.345 },
  { start: "2025-10-26T06:00:00+01:00", kwh: 1.274, price: 0.455 },
  { start: "2025-10-26T07:00:00+01:00", kwh: 1.354, price: 0.625 },
  { start: "2025-10-26T08:00:00+01:00", kwh: 1.483, price: 0.715 },
  { start: "2025-10-26T09:00:00+01:00", kwh: 1.601, price: 0.665 },
  { start: "2025-10-26T10:00:00+01:00", kwh: 1.648, price: 0.585 },
  { start: "2025-10-26T11:00:00+01:00", kwh: 1.649, price: 0.525 },
  { start: "2025-10-26T12:00:00+01:00", kwh: 1.644, price: 0.495 },
  { start: "2025-10-26T13:00:00+01:00", kwh: 1.636, price: 0.475 },
  { start: "2025-10-26T14:00:00+01:00", kwh: 1.658, price: 0.515 },
  { start: "2025-10-26T15:00:00+01:00", kwh: 1.71, price: 0.605 },
  { start: "2025-10-26T16:00:00+01:00", kwh: 1.794, price: 0.785 },
  { start: "2025-10-26T17:00:00+01:00", kwh: 1.88, price: 0.925 },
  { start: "2025-10-26T18:00:00+01:00", kwh: 1.899, price: 0.865 },
  { start: "2025-10-26T19:00:00+01:00", kwh: 1.886, price: 0.735 },
  { start: "2025-10-26T20:00:00+01:00", kwh: 1.862, price: 0.615 },
  { start: "2025-10-26T21:00:00+01:00", kwh: 1.802, price: 0.545 },
  { start: "2025-10-26T22:00:00+01:00", kwh: 1.708, price: 0.485 },
  { start: "2025-10-26T23:00:00+01:00", kwh: 1.59, price: 0.445 },
].map((row) => ({ ...row, start: new Date(row.start) }));

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
  price: {
    label: "Spot price",
    color: "chart-2",
    format: { preset: "unit-price", currency: "SEK", vat: "excluded" },
  },
} as const satisfies ChartConfig;

/**
 * Usage per hour as bars over the hour's illustrative spot price as a line, each on its own value
 * axis. One active dot rides the bar tops and the other the price line, both with the crosshair.
 */
export function BarChartPriceLine() {
  return (
    <BarChart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Usage and illustrative spot price per hour, 26 October 2025">
      <BarChart.Panel series={["kwh"]}>
        <BarChart.Grid />
        <BarChart.YAxis />
        <BarChart.Crosshair variant="line" />
        <BarChart.Bar dataKey="kwh" />
        <BarChart.ActiveDot dataKey="kwh" />
      </BarChart.Panel>
      <BarChart.Panel series={["price"]}>
        <BarChart.Grid />
        <BarChart.YAxis />
        <BarChart.Crosshair variant="line">
          <BarChart.SlotLabel />
        </BarChart.Crosshair>
        <BarChart.Line dataKey="price" />
        <BarChart.ActiveDot dataKey="price" />
        <BarChart.XAxis />
      </BarChart.Panel>
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
