"use client";

import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 household consumption per hour on the fall-back day 26 October 2025, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_FALL_BACK_2025_10_26 = [
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

type Row = (typeof NO1_FALL_BACK_2025_10_26)[number];

/** One row per hour with the household consumption per metering point. */
function perMeter(rows: readonly Row[]) {
  return rows
    .filter((row) => row.consumptionGroup === "household")
    .map((row) => ({ start: new Date(row.startTime), household: row.quantityKwh / row.meteringPointCount }));
}

const hours = perMeter(NO1_FALL_BACK_2025_10_26);

const config = {
  household: {
    label: "Household",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 2 },
  },
} as const satisfies ChartConfig;

/** Oslo falls back at 03:00, so the day lists 25 hours, two of them starting at 02:00. */
export function BarChartFallBackDay() {
  return (
    <BarChart.Root
      data={hours}
      config={config}
      xKey="start"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="Household consumption per metering point and hour, 26 October 2025">
      <BarChart.Grid />
      <BarChart.YAxis />
      <BarChart.XAxis />
      <BarChart.Bar dataKey="household" />
      <BarChart.Tooltip />
      <BarChart.Table />
    </BarChart.Root>
  );
}
