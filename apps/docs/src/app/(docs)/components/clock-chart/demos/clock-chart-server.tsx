import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 consumption per hour of households and services on 16 October 2026, in MWh, from the Elhub
// dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no.
// Elhub licenses its datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO1_GROUPS_2026_10_16 = [
  { startTime: "2026-10-16T00:00:00+02:00", household: 1508.764, tertiary: 877.003 },
  { startTime: "2026-10-16T01:00:00+02:00", household: 1390.568, tertiary: 854.471 },
  { startTime: "2026-10-16T02:00:00+02:00", household: 1323.137, tertiary: 842.146 },
  { startTime: "2026-10-16T03:00:00+02:00", household: 1284.84, tertiary: 839.089 },
  { startTime: "2026-10-16T04:00:00+02:00", household: 1277.306, tertiary: 855.808 },
  { startTime: "2026-10-16T05:00:00+02:00", household: 1311.858, tertiary: 938.144 },
  { startTime: "2026-10-16T06:00:00+02:00", household: 1453.704, tertiary: 1112.819 },
  { startTime: "2026-10-16T07:00:00+02:00", household: 1635.565, tertiary: 1311.993 },
  { startTime: "2026-10-16T08:00:00+02:00", household: 1635.339, tertiary: 1424.15 },
  { startTime: "2026-10-16T09:00:00+02:00", household: 1605.342, tertiary: 1473.159 },
  { startTime: "2026-10-16T10:00:00+02:00", household: 1574.773, tertiary: 1481.156 },
  { startTime: "2026-10-16T11:00:00+02:00", household: 1546.737, tertiary: 1455.244 },
  { startTime: "2026-10-16T12:00:00+02:00", household: 1546.604, tertiary: 1460.234 },
  { startTime: "2026-10-16T13:00:00+02:00", household: 1566.578, tertiary: 1455.528 },
  { startTime: "2026-10-16T14:00:00+02:00", household: 1607.275, tertiary: 1434.774 },
  { startTime: "2026-10-16T15:00:00+02:00", household: 1692.877, tertiary: 1388.408 },
  { startTime: "2026-10-16T16:00:00+02:00", household: 1827.078, tertiary: 1315.493 },
  { startTime: "2026-10-16T17:00:00+02:00", household: 1910.023, tertiary: 1245.745 },
  { startTime: "2026-10-16T18:00:00+02:00", household: 1997.781, tertiary: 1250.212 },
  { startTime: "2026-10-16T19:00:00+02:00", household: 2025.464, tertiary: 1226.654 },
  { startTime: "2026-10-16T20:00:00+02:00", household: 1990.839, tertiary: 1176.871 },
  { startTime: "2026-10-16T21:00:00+02:00", household: 1948.121, tertiary: 1124.821 },
  { startTime: "2026-10-16T22:00:00+02:00", household: 1917.934, tertiary: 1060.101 },
  { startTime: "2026-10-16T23:00:00+02:00", household: 1835.485, tertiary: 1003.998 },
];

const hours = NO1_GROUPS_2026_10_16.map(({ startTime, household, tertiary }) => ({
  start: new Date(startTime),
  household,
  tertiary,
}));

const energy = { preset: "energy", unit: "MWh", maximumFractionDigits: 0 } as const;

const config = {
  household: { label: "Households", color: "chart-1", stack: "groups", format: energy },
  tertiary: { label: "Services", color: "chart-2", stack: "groups", format: energy },
} as const satisfies ChartConfig;

/**
 * A server component. The file has no `"use client"` line, and every prop it passes is plain data,
 * so the server writes the dial, the wedges, the labels and the table, and sends only the chart's
 * own parts to the browser.
 */
export function ClockChartServer() {
  return (
    <ClockChart.Root
      data={hours}
      config={config}
      xKey="start"
      cycle="day"
      interval="hour"
      timeZone="Europe/Oslo"
      aria-label="NO1 consumption per hour by group, 16 October 2026">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Column dataKey="household" />
      <ClockChart.Column dataKey="tertiary" />
      <ClockChart.Legend />
      <ClockChart.Tooltip>
        <ClockChart.TooltipLabel />
        <ClockChart.TooltipItems />
        <ClockChart.TooltipTotal />
      </ClockChart.Tooltip>
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
