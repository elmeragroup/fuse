"use client";

import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 household consumption per metering point and month, November 2024 to October 2026, computed
// from the Elhub dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no.
// Elhub licenses its datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_HOUSEHOLD_MONTHLY = [
  { month: "2024-11", kwh: 1425.25 },
  { month: "2024-12", kwh: 1646.62 },
  { month: "2025-01", kwh: 1837.12 },
  { month: "2025-02", kwh: 1603.55 },
  { month: "2025-03", kwh: 1398.42 },
  { month: "2025-04", kwh: 1004.97 },
  { month: "2025-05", kwh: 863.99 },
  { month: "2025-06", kwh: 715.08 },
  { month: "2025-07", kwh: 592.65 },
  { month: "2025-08", kwh: 683.19 },
  { month: "2025-09", kwh: 781.47 },
  { month: "2025-10", kwh: 1125.71 },
  { month: "2025-11", kwh: 1413.92 },
  { month: "2025-12", kwh: 1582.73 },
  { month: "2026-01", kwh: 2091.35 },
  { month: "2026-02", kwh: 1892.3 },
  { month: "2026-03", kwh: 1480.73 },
  { month: "2026-04", kwh: 1128.18 },
  { month: "2026-05", kwh: 927.42 },
  { month: "2026-06", kwh: 716.2 },
  { month: "2026-07", kwh: 622.97 },
  { month: "2026-08", kwh: 701.11 },
  { month: "2026-09", kwh: 801.92 },
  { month: "2026-10", kwh: 552.63 },
];

/** The first midnight of a month in Oslo: CEST from April to October, CET otherwise. */
function monthStart(month: string): Date {
  const summer = Number(month.slice(5)) >= 4 && Number(month.slice(5)) <= 10;
  return new Date(`${month}-01T00:00:00${summer ? "+02:00" : "+01:00"}`);
}

const months = NO1_HOUSEHOLD_MONTHLY.filter(({ month }) => month.startsWith("2025")).map(
  ({ month, kwh }) => ({
    start: monthStart(month),
    kwh,
  })
);

const config = {
  kwh: {
    label: "Household",
    color: "chart-1",
    format: { preset: "energy", unit: "kWh", maximumFractionDigits: 0 },
  },
} as const satisfies ChartConfig;

export function ClockChartHeatingYear() {
  return (
    <ClockChart.Root
      data={months}
      config={config}
      xKey="start"
      cycle="year"
      timeZone="Europe/Oslo"
      interval="month"
      aria-label="A household's consumption per month in NO1, 2025">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.RadiusAxis />
      <ClockChart.Column dataKey="kwh" emphasis="max" />
      <ClockChart.Center>
        <ClockChart.ActiveValue dataKey="kwh" fallback="max" />
      </ClockChart.Center>
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
