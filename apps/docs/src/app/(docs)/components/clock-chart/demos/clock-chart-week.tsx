"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

import {
  HOURLY_AUTUMN_KWH,
  HOURLY_AUTUMN_START,
} from "../../chart/demos/data/no1-household-hourly-2025-09-2025-10";

const HOUR = 3_600_000;

/** The week from Monday 13 October 2025 in Oslo. */
const monday = Date.parse("2025-10-12T22:00:00Z");
const first = (monday - Date.parse(HOURLY_AUTUMN_START)) / HOUR;

// One reading an hour for the whole week. The weekend's sector marks Saturday and Sunday, so every
// hour's tooltip lists the one reading it has.
const hours = HOURLY_AUTUMN_KWH.slice(first, first + 168).map((kwh, hour) => ({
  start: monday + hour * HOUR,
  kwh,
}));

/** Saturday 00:00 and Sunday 23:00, the weekend's first and last hours. */
const saturday = monday + 120 * HOUR;
const lastHour = monday + 167 * HOUR;

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  kwh: { label: "Consumption", color: "chart-1", format: energy },
} as const satisfies ChartConfig;

export function ClockChartWeek() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="week"
      timeZone="Europe/Oslo"
      interval="hour"
      aria-label="A household's week, weekdays against the weekend">
      <ClockChart.Grid />
      <ClockChart.ReferenceArea x1={saturday} x2={lastHour} label="Weekend" />
      <ClockChart.AngleAxis />
      <ClockChart.Column dataKey="kwh" />
      <ClockChart.Legend />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
