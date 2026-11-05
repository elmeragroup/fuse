"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// Consumption per metering point on 16 October 2026 for every price area and consumption group,
// computed from the Elhub dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub
// licenses its datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
export const NO_GROUPS_2026_10_16 = [
  { area: "NO1", group: "household", kwh: 39525296.7, meteringPoints: 1126105 },
  { area: "NO1", group: "cabin", kwh: 2004591.9, meteringPoints: 111343 },
  { area: "NO1", group: "primary", kwh: 1050539.6, meteringPoints: 7464 },
  { area: "NO1", group: "secondary", kwh: 13121739.2, meteringPoints: 15214 },
  { area: "NO1", group: "tertiary", kwh: 28681425.8, meteringPoints: 97272 },
  { area: "NO2", group: "household", kwh: 23576759.9, meteringPoints: 637518 },
  { area: "NO2", group: "cabin", kwh: 1532338.4, meteringPoints: 107085 },
  { area: "NO2", group: "primary", kwh: 1979897.7, meteringPoints: 5789 },
  { area: "NO2", group: "secondary", kwh: 53213877.5, meteringPoints: 12910 },
  { area: "NO2", group: "tertiary", kwh: 16530672.2, meteringPoints: 74927 },
  { area: "NO3", group: "household", kwh: 16176910.8, meteringPoints: 413861 },
  { area: "NO3", group: "cabin", kwh: 1003913.8, meteringPoints: 63111 },
  { area: "NO3", group: "primary", kwh: 2238770.3, meteringPoints: 10155 },
  { area: "NO3", group: "secondary", kwh: 42524615.2, meteringPoints: 9295 },
  { area: "NO3", group: "tertiary", kwh: 12566279.5, meteringPoints: 52627 },
  { area: "NO4", group: "household", kwh: 12138228.9, meteringPoints: 246900 },
  { area: "NO4", group: "cabin", kwh: 962531.9, meteringPoints: 44651 },
  { area: "NO4", group: "primary", kwh: 1787005.7, meteringPoints: 4001 },
  { area: "NO4", group: "secondary", kwh: 28809582.9, meteringPoints: 6233 },
  { area: "NO4", group: "tertiary", kwh: 10627723.0, meteringPoints: 40742 },
  { area: "NO5", group: "household", kwh: 9622327.0, meteringPoints: 261386 },
  { area: "NO5", group: "cabin", kwh: 981402.2, meteringPoints: 49000 },
  { area: "NO5", group: "primary", kwh: 338967.9, meteringPoints: 1957 },
  { area: "NO5", group: "secondary", kwh: 27987457.4, meteringPoints: 5055 },
  { area: "NO5", group: "tertiary", kwh: 6759071.6, meteringPoints: 28385 },
];

const GROUPS = [
  ["household", "Households"],
  ["cabin", "Cabins"],
  ["primary", "Primary"],
  ["secondary", "Industry"],
  ["tertiary", "Services"],
] as const;

/**
 * Each group's use per metering point in an area as an index, where 100 is the group's use per
 * metering point over all five areas.
 */
function indexOf(area: string, group: string): number {
  const rows = NO_GROUPS_2026_10_16.filter((row) => row.group === group);
  const mean =
    rows.reduce((sum, row) => sum + row.kwh, 0) / rows.reduce((sum, row) => sum + row.meteringPoints, 0);
  const own = rows.find((row) => row.area === area);
  return own === undefined ? 0 : Math.round((own.kwh / own.meteringPoints / mean) * 1000) / 10;
}

const groups = GROUPS.map(([group, name]) => ({
  group: name,
  no1: indexOf("NO1", group),
  no2: indexOf("NO2", group),
  no3: indexOf("NO3", group),
  no4: indexOf("NO4", group),
}));

const config = {
  no1: { label: "NO1", color: "chart-1" },
  no2: { label: "NO2", color: "chart-2" },
  no3: { label: "NO3", color: "chart-3" },
  no4: { label: "NO4", color: "chart-4" },
} as const satisfies ChartConfig;

export function RadarChartAreas() {
  return (
    <RadarChart.Root
      data={groups}
      config={config}
      nameKey="group"
      aria-label="Use per metering point by consumption group and price area, as an index">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Line dataKey="no1" />
      <RadarChart.Line dataKey="no2" />
      <RadarChart.Line dataKey="no3" />
      <RadarChart.Line dataKey="no4" />
      <RadarChart.Dots dataKey="no1" variant="ring" />
      <RadarChart.Legend />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
