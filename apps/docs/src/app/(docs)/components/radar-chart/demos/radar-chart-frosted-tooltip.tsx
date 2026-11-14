"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";

// A NO1 household's mean day per weekday in October 2025, in kWh, computed from
// the Elhub dataset CONSUMPTION_PER_GROUP_MBA_HOUR at https://api.elhub.no. Elhub licenses its
// datasets under CC BY 4.0, https://creativecommons.org/licenses/by/4.0/.
const weekdays = [
  { day: "Mon", thisYear: 36.9 },
  { day: "Tue", thisYear: 36.4 },
  { day: "Wed", thisYear: 35.1 },
  { day: "Thu", thisYear: 35.6 },
  { day: "Fri", thisYear: 37.1 },
  { day: "Sat", thisYear: 35.8 },
  { day: "Sun", thisYear: 37.5 },
];

const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

const config = {
  thisYear: { label: "October 2025", color: "chart-1", format: energy },
} as const satisfies ChartConfig;

export function RadarChartFrostedTooltip() {
  return (
    <RadarChart.Root
      data={weekdays}
      config={config}
      nameKey="day"
      defaultActiveName="Sun"
      aria-label="A household's mean day per weekday in NO1, October 2025">
      <RadarChart.Grid />
      <RadarChart.AngleAxis />
      <RadarChart.RadiusAxis />
      <RadarChart.Area dataKey="thisYear" />
      <RadarChart.Line dataKey="thisYear" />
      <RadarChart.Tooltip variant="frosted" />
      <RadarChart.Table />
    </RadarChart.Root>
  );
}
