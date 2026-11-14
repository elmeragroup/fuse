import { ClockChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// NO1 consumption per hour on 16 October 2026, in MWh, from the Elhub dataset
// CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its datasets under
// CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
const HOUSEHOLDS = [
  1509, 1391, 1323, 1285, 1277, 1312, 1454, 1636, 1635, 1605, 1575, 1547, 1547, 1567, 1607, 1693, 1827, 1910,
  1998, 2025, 1991, 1948, 1918, 1835,
];
const SERVICES = [
  877, 854, 842, 839, 856, 938, 1113, 1312, 1424, 1473, 1481, 1455, 1460, 1456, 1435, 1388, 1315, 1246, 1250,
  1227, 1177, 1125, 1060, 1004,
];

// 16 October 2026 starts at 22:00 UTC on the 15th, since Oslo is on summer time.
const hours = HOUSEHOLDS.map((households, hour) => ({
  start: new Date(Date.UTC(2026, 9, 15, 22 + hour)),
  households,
  services: SERVICES[hour] ?? 0,
}));

const energy = { preset: "energy", unit: "MWh", maximumFractionDigits: 0 } as const;

const config = {
  households: { label: "Households", color: "chart-1", stack: "groups", format: energy },
  services: { label: "Services", color: "chart-2", stack: "groups", format: energy },
} as const satisfies ChartConfig;

/**
 * A server component. The file has no `"use client"` line, and every prop it passes is plain data,
 * so the server writes the dial, the wedges, the labels and the table.
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
      aria-label="NO1 household consumption per hour, 16 October 2026">
      <ClockChart.Grid />
      <ClockChart.AngleAxis />
      <ClockChart.Column dataKey="households" />
      <ClockChart.Column dataKey="services" />
      <ClockChart.Tooltip />
      <ClockChart.Table />
    </ClockChart.Root>
  );
}
