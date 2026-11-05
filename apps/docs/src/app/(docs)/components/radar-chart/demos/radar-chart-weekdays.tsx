"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 household consumption per metering point and day in October 2025, computed from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_DAILY_2025_10 = [
  { date: "2025-10-01", kwh: 32.33 },
  { date: "2025-10-02", kwh: 31.47 },
  { date: "2025-10-03", kwh: 31.2 },
  { date: "2025-10-04", kwh: 34.64 },
  { date: "2025-10-05", kwh: 34.1 },
  { date: "2025-10-06", kwh: 32.35 },
  { date: "2025-10-07", kwh: 31.7 },
  { date: "2025-10-08", kwh: 30.66 },
  { date: "2025-10-09", kwh: 33.58 },
  { date: "2025-10-10", kwh: 33.93 },
  { date: "2025-10-11", kwh: 31.09 },
  { date: "2025-10-12", kwh: 32.46 },
  { date: "2025-10-13", kwh: 34.9 },
  { date: "2025-10-14", kwh: 32.33 },
  { date: "2025-10-15", kwh: 33.33 },
  { date: "2025-10-16", kwh: 35.48 },
  { date: "2025-10-17", kwh: 38.82 },
  { date: "2025-10-18", kwh: 41.91 },
  { date: "2025-10-19", kwh: 44.59 },
  { date: "2025-10-20", kwh: 42.75 },
  { date: "2025-10-21", kwh: 40.29 },
  { date: "2025-10-22", kwh: 36.65 },
  { date: "2025-10-23", kwh: 34.61 },
  { date: "2025-10-24", kwh: 35.44 },
  { date: "2025-10-25", kwh: 35.63 },
  { date: "2025-10-26", kwh: 39.04 },
  { date: "2025-10-27", kwh: 37.74 },
  { date: "2025-10-28", kwh: 41.16 },
  { date: "2025-10-29", kwh: 42.4 },
  { date: "2025-10-30", kwh: 42.78 },
  { date: "2025-10-31", kwh: 46.34 },
];

// NO1 household consumption per metering point and day in October 2024, from the same Elhub dataset
// under the same licence.
export const NO1_HOUSEHOLD_DAILY_2024_10 = [
  { date: "2024-10-01", kwh: 32.06 },
  { date: "2024-10-02", kwh: 32.24 },
  { date: "2024-10-03", kwh: 31.89 },
  { date: "2024-10-04", kwh: 32.78 },
  { date: "2024-10-05", kwh: 32.62 },
  { date: "2024-10-06", kwh: 32.37 },
  { date: "2024-10-07", kwh: 33.18 },
  { date: "2024-10-08", kwh: 32.64 },
  { date: "2024-10-09", kwh: 31.29 },
  { date: "2024-10-10", kwh: 32.45 },
  { date: "2024-10-11", kwh: 35.73 },
  { date: "2024-10-12", kwh: 39.91 },
  { date: "2024-10-13", kwh: 38.44 },
  { date: "2024-10-14", kwh: 38.61 },
  { date: "2024-10-15", kwh: 40.51 },
  { date: "2024-10-16", kwh: 40.22 },
  { date: "2024-10-17", kwh: 37.73 },
  { date: "2024-10-18", kwh: 35.44 },
  { date: "2024-10-19", kwh: 33.65 },
  { date: "2024-10-20", kwh: 34.11 },
  { date: "2024-10-21", kwh: 31.89 },
  { date: "2024-10-22", kwh: 33.84 },
  { date: "2024-10-23", kwh: 35.7 },
  { date: "2024-10-24", kwh: 33.67 },
  { date: "2024-10-25", kwh: 34.9 },
  { date: "2024-10-26", kwh: 36.65 },
  { date: "2024-10-27", kwh: 37.83 },
  { date: "2024-10-28", kwh: 36.7 },
  { date: "2024-10-29", kwh: 40.1 },
  { date: "2024-10-30", kwh: 39.03 },
  { date: "2024-10-31", kwh: 37.22 },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Each weekday's mean day, Monday first. */
function weekdayMeans(days: readonly { date: string; kwh: number }[]): number[] {
  const sums = WEEKDAYS.map(() => ({ kwh: 0, count: 0 }));
  for (const { date, kwh } of days) {
    // getUTCDay counts from Sunday, so Monday lands on 0.
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const sum = sums[weekday];
    if (sum === undefined) continue;
    sum.kwh += kwh;
    sum.count += 1;
  }
  return sums.map(({ kwh, count }) => Math.round((kwh / count) * 10) / 10);
}

const thisYear = weekdayMeans(NO1_HOUSEHOLD_DAILY_2025_10);
const lastYear = weekdayMeans(NO1_HOUSEHOLD_DAILY_2024_10);
const weekdays = WEEKDAYS.map((day, index) => ({
  day,
  thisYear: thisYear[index] ?? 0,
  lastYear: lastYear[index] ?? 0,
}));

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  thisYear: { label: "October 2025", color: "chart-1", format: energy },
  lastYear: { label: "October 2024", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function RadarChartWeekdays() {
  return (
    <RadarChart.Root
      data={weekdays}
      config={config}
      nameKey="day"
      aria-label="A household's mean day per weekday in NO1, October against last October">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Area dataKey="thisYear" />
      <RadarChart.Line dataKey="thisYear" />
      <RadarChart.Line dataKey="lastYear" variant="dashed" />
      <RadarChart.ActiveDot dataKey="thisYear" />
      <RadarChart.Legend />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
