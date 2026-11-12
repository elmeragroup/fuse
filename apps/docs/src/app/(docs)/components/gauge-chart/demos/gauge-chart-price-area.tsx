"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// The spot price in NO2 for the current hour, read on a sector and rings of dots with no track.
const price = { preset: "unit-price", currency: "NOK", minor: true, vat: "excluded" } as const;

export function GaugeChartPriceArea() {
  return (
    <GaugeChart.Root value={86.4} max={200} valueFormat={price} aria-label="Spot price in NO2 now">
      <GaugeChart.Sector variant="conic" />
      <GaugeChart.Dots variant="fade" />
      <GaugeChart.Ruler variant="outside" />
      <GaugeChart.Needle />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
        <GaugeChart.CenterLabel>NO2 this hour</GaugeChart.CenterLabel>
      </GaugeChart.Center>
    </GaugeChart.Root>
  );
}
