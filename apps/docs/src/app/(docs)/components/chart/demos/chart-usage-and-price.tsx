"use client";

import { Chart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 household consumption per hour on the fall-back day 26 October 2025, from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_2025_10_26 = [
  {
    startTime: "2025-10-26T00:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1571242.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T01:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1492842.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T02:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1434677.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T02:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1394542.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T03:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1375271.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T04:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1372822.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T05:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1384732.6,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T06:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1424383.4,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T07:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1513880.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T08:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1658430.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T09:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1789900.8,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T10:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1843404.6,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T11:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1844321.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T12:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1838413.9,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T13:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1829916.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T14:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1854605.4,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T15:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1912368.2,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T16:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2005894.6,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T17:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2102769.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T18:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2123271.8,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T19:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2108637.8,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T20:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2082325.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T21:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 2014850.1,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T22:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1910449.0,
    meteringPointCount: 1118310,
  },
  {
    startTime: "2025-10-26T23:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1777729.5,
    meteringPointCount: 1118310,
  },
];

// An invented SE3 spot price day in SEK per kWh, the 100 quarters of 26 October 2025. It follows the
// elprisetjustnu.se file shape, and every value is typed by hand, so it carries no market data.
export const PRICE_DAY_2025_10_26 = [
  { time_start: "2025-10-26T00:00:00+02:00", SEK_per_kWh: 0.42 },
  { time_start: "2025-10-26T00:15:00+02:00", SEK_per_kWh: 0.43 },
  { time_start: "2025-10-26T00:30:00+02:00", SEK_per_kWh: 0.415 },
  { time_start: "2025-10-26T00:45:00+02:00", SEK_per_kWh: 0.435 },
  { time_start: "2025-10-26T01:00:00+02:00", SEK_per_kWh: 0.38 },
  { time_start: "2025-10-26T01:15:00+02:00", SEK_per_kWh: 0.39 },
  { time_start: "2025-10-26T01:30:00+02:00", SEK_per_kWh: 0.375 },
  { time_start: "2025-10-26T01:45:00+02:00", SEK_per_kWh: 0.395 },
  { time_start: "2025-10-26T02:00:00+02:00", SEK_per_kWh: 0.35 },
  { time_start: "2025-10-26T02:15:00+02:00", SEK_per_kWh: 0.36 },
  { time_start: "2025-10-26T02:30:00+02:00", SEK_per_kWh: 0.345 },
  { time_start: "2025-10-26T02:45:00+02:00", SEK_per_kWh: 0.365 },
  { time_start: "2025-10-26T02:00:00+01:00", SEK_per_kWh: 0.33 },
  { time_start: "2025-10-26T02:15:00+01:00", SEK_per_kWh: 0.34 },
  { time_start: "2025-10-26T02:30:00+01:00", SEK_per_kWh: 0.325 },
  { time_start: "2025-10-26T02:45:00+01:00", SEK_per_kWh: 0.345 },
  { time_start: "2025-10-26T03:00:00+01:00", SEK_per_kWh: 0.31 },
  { time_start: "2025-10-26T03:15:00+01:00", SEK_per_kWh: 0.32 },
  { time_start: "2025-10-26T03:30:00+01:00", SEK_per_kWh: 0.305 },
  { time_start: "2025-10-26T03:45:00+01:00", SEK_per_kWh: 0.325 },
  { time_start: "2025-10-26T04:00:00+01:00", SEK_per_kWh: 0.3 },
  { time_start: "2025-10-26T04:15:00+01:00", SEK_per_kWh: 0.31 },
  { time_start: "2025-10-26T04:30:00+01:00", SEK_per_kWh: 0.295 },
  { time_start: "2025-10-26T04:45:00+01:00", SEK_per_kWh: 0.315 },
  { time_start: "2025-10-26T05:00:00+01:00", SEK_per_kWh: 0.34 },
  { time_start: "2025-10-26T05:15:00+01:00", SEK_per_kWh: 0.35 },
  { time_start: "2025-10-26T05:30:00+01:00", SEK_per_kWh: 0.335 },
  { time_start: "2025-10-26T05:45:00+01:00", SEK_per_kWh: 0.355 },
  { time_start: "2025-10-26T06:00:00+01:00", SEK_per_kWh: 0.45 },
  { time_start: "2025-10-26T06:15:00+01:00", SEK_per_kWh: 0.46 },
  { time_start: "2025-10-26T06:30:00+01:00", SEK_per_kWh: 0.445 },
  { time_start: "2025-10-26T06:45:00+01:00", SEK_per_kWh: 0.465 },
  { time_start: "2025-10-26T07:00:00+01:00", SEK_per_kWh: 0.62 },
  { time_start: "2025-10-26T07:15:00+01:00", SEK_per_kWh: 0.63 },
  { time_start: "2025-10-26T07:30:00+01:00", SEK_per_kWh: 0.615 },
  { time_start: "2025-10-26T07:45:00+01:00", SEK_per_kWh: 0.635 },
  { time_start: "2025-10-26T08:00:00+01:00", SEK_per_kWh: 0.71 },
  { time_start: "2025-10-26T08:15:00+01:00", SEK_per_kWh: 0.72 },
  { time_start: "2025-10-26T08:30:00+01:00", SEK_per_kWh: 0.705 },
  { time_start: "2025-10-26T08:45:00+01:00", SEK_per_kWh: 0.725 },
  { time_start: "2025-10-26T09:00:00+01:00", SEK_per_kWh: 0.66 },
  { time_start: "2025-10-26T09:15:00+01:00", SEK_per_kWh: 0.67 },
  { time_start: "2025-10-26T09:30:00+01:00", SEK_per_kWh: 0.655 },
  { time_start: "2025-10-26T09:45:00+01:00", SEK_per_kWh: 0.675 },
  { time_start: "2025-10-26T10:00:00+01:00", SEK_per_kWh: 0.58 },
  { time_start: "2025-10-26T10:15:00+01:00", SEK_per_kWh: 0.59 },
  { time_start: "2025-10-26T10:30:00+01:00", SEK_per_kWh: 0.575 },
  { time_start: "2025-10-26T10:45:00+01:00", SEK_per_kWh: 0.595 },
  { time_start: "2025-10-26T11:00:00+01:00", SEK_per_kWh: 0.52 },
  { time_start: "2025-10-26T11:15:00+01:00", SEK_per_kWh: 0.53 },
  { time_start: "2025-10-26T11:30:00+01:00", SEK_per_kWh: 0.515 },
  { time_start: "2025-10-26T11:45:00+01:00", SEK_per_kWh: 0.535 },
  { time_start: "2025-10-26T12:00:00+01:00", SEK_per_kWh: 0.49 },
  { time_start: "2025-10-26T12:15:00+01:00", SEK_per_kWh: 0.5 },
  { time_start: "2025-10-26T12:30:00+01:00", SEK_per_kWh: 0.485 },
  { time_start: "2025-10-26T12:45:00+01:00", SEK_per_kWh: 0.505 },
  { time_start: "2025-10-26T13:00:00+01:00", SEK_per_kWh: 0.47 },
  { time_start: "2025-10-26T13:15:00+01:00", SEK_per_kWh: 0.48 },
  { time_start: "2025-10-26T13:30:00+01:00", SEK_per_kWh: 0.465 },
  { time_start: "2025-10-26T13:45:00+01:00", SEK_per_kWh: 0.485 },
  { time_start: "2025-10-26T14:00:00+01:00", SEK_per_kWh: 0.51 },
  { time_start: "2025-10-26T14:15:00+01:00", SEK_per_kWh: 0.52 },
  { time_start: "2025-10-26T14:30:00+01:00", SEK_per_kWh: 0.505 },
  { time_start: "2025-10-26T14:45:00+01:00", SEK_per_kWh: 0.525 },
  { time_start: "2025-10-26T15:00:00+01:00", SEK_per_kWh: 0.6 },
  { time_start: "2025-10-26T15:15:00+01:00", SEK_per_kWh: 0.61 },
  { time_start: "2025-10-26T15:30:00+01:00", SEK_per_kWh: 0.595 },
  { time_start: "2025-10-26T15:45:00+01:00", SEK_per_kWh: 0.615 },
  { time_start: "2025-10-26T16:00:00+01:00", SEK_per_kWh: 0.78 },
  { time_start: "2025-10-26T16:15:00+01:00", SEK_per_kWh: 0.79 },
  { time_start: "2025-10-26T16:30:00+01:00", SEK_per_kWh: 0.775 },
  { time_start: "2025-10-26T16:45:00+01:00", SEK_per_kWh: 0.795 },
  { time_start: "2025-10-26T17:00:00+01:00", SEK_per_kWh: 0.92 },
  { time_start: "2025-10-26T17:15:00+01:00", SEK_per_kWh: 0.93 },
  { time_start: "2025-10-26T17:30:00+01:00", SEK_per_kWh: 0.915 },
  { time_start: "2025-10-26T17:45:00+01:00", SEK_per_kWh: 0.935 },
  { time_start: "2025-10-26T18:00:00+01:00", SEK_per_kWh: 0.86 },
  { time_start: "2025-10-26T18:15:00+01:00", SEK_per_kWh: 0.87 },
  { time_start: "2025-10-26T18:30:00+01:00", SEK_per_kWh: 0.855 },
  { time_start: "2025-10-26T18:45:00+01:00", SEK_per_kWh: 0.875 },
  { time_start: "2025-10-26T19:00:00+01:00", SEK_per_kWh: 0.73 },
  { time_start: "2025-10-26T19:15:00+01:00", SEK_per_kWh: 0.74 },
  { time_start: "2025-10-26T19:30:00+01:00", SEK_per_kWh: 0.725 },
  { time_start: "2025-10-26T19:45:00+01:00", SEK_per_kWh: 0.745 },
  { time_start: "2025-10-26T20:00:00+01:00", SEK_per_kWh: 0.61 },
  { time_start: "2025-10-26T20:15:00+01:00", SEK_per_kWh: 0.62 },
  { time_start: "2025-10-26T20:30:00+01:00", SEK_per_kWh: 0.605 },
  { time_start: "2025-10-26T20:45:00+01:00", SEK_per_kWh: 0.625 },
  { time_start: "2025-10-26T21:00:00+01:00", SEK_per_kWh: 0.54 },
  { time_start: "2025-10-26T21:15:00+01:00", SEK_per_kWh: 0.55 },
  { time_start: "2025-10-26T21:30:00+01:00", SEK_per_kWh: 0.535 },
  { time_start: "2025-10-26T21:45:00+01:00", SEK_per_kWh: 0.555 },
  { time_start: "2025-10-26T22:00:00+01:00", SEK_per_kWh: 0.48 },
  { time_start: "2025-10-26T22:15:00+01:00", SEK_per_kWh: 0.49 },
  { time_start: "2025-10-26T22:30:00+01:00", SEK_per_kWh: 0.475 },
  { time_start: "2025-10-26T22:45:00+01:00", SEK_per_kWh: 0.495 },
  { time_start: "2025-10-26T23:00:00+01:00", SEK_per_kWh: 0.44 },
  { time_start: "2025-10-26T23:15:00+01:00", SEK_per_kWh: 0.45 },
  { time_start: "2025-10-26T23:30:00+01:00", SEK_per_kWh: 0.435 },
  { time_start: "2025-10-26T23:45:00+01:00", SEK_per_kWh: 0.455 },
];

/** Each hour's usage per metering point, by the hour's start instant. */
const usage = new Map(
  NO1_HOUSEHOLD_2025_10_26.map((row) => [
    new Date(row.startTime).getTime(),
    row.quantityKwh / row.meteringPointCount,
  ])
);

/** One row per quarter. The hourly usage sits on each hour's first quarter alone. */
const rows = PRICE_DAY_2025_10_26.map((row) => {
  const start = new Date(row.time_start);
  const kwh = usage.get(start.getTime());
  return kwh === undefined ? { start, price: row.SEK_per_kWh } : { start, price: row.SEK_per_kWh, kwh };
});

const config = {
  kwh: {
    label: "Usage",
    color: "chart-1",
    interval: "hour",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
  price: {
    label: "Spot price",
    color: "chart-2",
    format: { preset: "unit-price", currency: "SEK", vat: "excluded" },
  },
} as const satisfies ChartConfig;

/**
 * Usage per hour over an illustrative spot price per quarter, on the day with 25 hours. Each hourly
 * bar spans its 4 quarters, and one listbox walks the quarters of both Panels.
 */
export function ChartUsageAndPrice() {
  return (
    <Chart.Root
      data={rows}
      config={config}
      xKey="start"
      interval="quarter-hour"
      timeZone="Europe/Oslo"
      aria-label="Usage per hour and illustrative spot price per quarter, 26 October 2025">
      <Chart.Panel series={["kwh"]}>
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.Crosshair />
        <Chart.Bar dataKey="kwh" />
      </Chart.Panel>
      <Chart.Panel series={["price"]}>
        <Chart.Grid />
        <Chart.YAxis />
        <Chart.Crosshair variant="line" />
        <Chart.Line dataKey="price" curve="step-after" />
        <Chart.ActiveDot dataKey="price" />
        <Chart.XAxis />
      </Chart.Panel>
      <Chart.Tooltip />
      <Chart.LegendToggleGroup />
      <Chart.Table />
    </Chart.Root>
  );
}
