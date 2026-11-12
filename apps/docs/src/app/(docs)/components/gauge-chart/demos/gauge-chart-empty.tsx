"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// A new meter that has sent no reading for this hour yet.
const energy = { preset: "energy", unit: "kWh", maximumFractionDigits: 1 } as const;

export function GaugeChartEmpty() {
  return (
    <GaugeChart.Root value={null} max={5} valueFormat={energy} aria-label="This hour's consumption">
      <GaugeChart.Track />
      <GaugeChart.Fill />
      <GaugeChart.Empty />
    </GaugeChart.Root>
  );
}
