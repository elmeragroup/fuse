"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 household consumption per hour on the spring-forward day 29 March 2026, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_SPRING_2026_03_29 = [
  {
    startTime: "2026-03-29T00:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1974532.9,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T01:00:00+01:00",
    consumptionGroup: "household",
    quantityKwh: 1922605.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T03:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1902129.6,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T04:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1885827.5,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T05:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1886613.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T06:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1905999.1,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T07:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1940179.9,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T08:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2002439.6,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T09:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2073275.2,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T10:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2100190.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T11:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2072195.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T12:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2012351.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T13:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1970783.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T14:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1939109.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T15:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 1966314.6,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T16:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2053701.1,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T17:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2132245.5,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T18:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2195977.5,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T19:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2247678.2,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T20:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2281528.0,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T21:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2269646.2,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T22:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2219442.8,
    meteringPointCount: 1121511,
  },
  {
    startTime: "2026-03-29T23:00:00+02:00",
    consumptionGroup: "household",
    quantityKwh: 2127512.0,
    meteringPointCount: 1121511,
  },
];

type Row = (typeof NO1_SPRING_2026_03_29)[number];

/** One row per hour with the household consumption per metering point. */
function perMeter(rows: readonly Row[]) {
  return rows
    .filter((row) => row.consumptionGroup === "household")
    .map((row) => ({ start: new Date(row.startTime), household: row.quantityKwh / row.meteringPointCount }));
}

const hours = perMeter(NO1_SPRING_2026_03_29);

const config = {
  household: {
    label: "Household",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** Oslo springs forward at 02:00, so the day lists 23 hours and no hour starts at 02:00. */
export function BarChartSpringForwardDay() {
  return (
    <BarChart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Household consumption per metering point and hour, 29 March 2026">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="household" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
