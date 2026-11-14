"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A NO1 household's mean day per weekday in October 2025 and October 2024, in kWh, computed from
// the Elhub dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its
// datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
const weekdays = [
  { day: "Mon", thisYear: 36.9, lastYear: 35.1 },
  { day: "Tue", thisYear: 36.4, lastYear: 35.8 },
  { day: "Wed", thisYear: 35.1, lastYear: 35.7 },
  { day: "Thu", thisYear: 35.6, lastYear: 34.6 },
  { day: "Fri", thisYear: 37.1, lastYear: 34.7 },
  { day: "Sat", thisYear: 35.8, lastYear: 35.7 },
  { day: "Sun", thisYear: 37.5, lastYear: 35.7 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  thisYear: { label: "October 2025", color: "chart-1", format: energy },
  lastYear: { label: "October 2024", color: "chart-2", format: energy },
} as const satisfies ChartConfig;

export function RadarChartDashedLine() {
  return (
    <RadarChart.Root
      data={weekdays}
      config={config}
      nameKey="day"
      aria-label="A household's mean day per weekday in NO1, October 2025">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Area dataKey="thisYear" />
      <RadarChart.Line dataKey="thisYear" />
      <RadarChart.Line dataKey="lastYear" variant="dashed" />
      <RadarChart.Tooltip />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
