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

// Each hour lands in the weekday column or the weekend one, so the two colours split the week.
const hours = HOURLY_AUTUMN_KWH.slice(first, first + 168).map((kwh, hour) => {
  const start = monday + hour * HOUR;
  return hour < 120 ? { start, weekday: kwh } : { start, weekend: kwh };
});

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 2 } as const;

const config = {
  weekday: { label: "Weekday", color: "chart-1", format: energy },
  weekend: { label: "Weekend", color: "chart-4", format: energy },
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
      <ClockChart.AngleAxis />
      <ClockChart.Column dataKey="weekday" />
      <ClockChart.Column dataKey="weekend" />
      <ClockChart.Legend />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
