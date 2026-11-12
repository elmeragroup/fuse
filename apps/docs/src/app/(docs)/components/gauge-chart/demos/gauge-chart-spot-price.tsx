"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

// The spot price in NO1 for the current quarter-hour, against the day's cheap and dear bands.
const price = { preset: "unit-price", currency: "NOK", minor: true, vat: "included" } as const;

export function GaugeChartSpotPrice() {
  return (
    <GaugeChart.Root
      value={142.3}
      max={300}
      valueFormat={price}
      style={{ "--chart-polar-size": "18rem" }}
      aria-label="Spot price in NO1 now">
      <GaugeChart.Ruler variant="outside" />
      <GaugeChart.Zone from={0} to={80} color="chart-sentiment-positive" />
      <GaugeChart.Zone from={200} to={300} color="chart-sentiment-negative" />
      <GaugeChart.Track variant="solid" />
      <GaugeChart.Fill />
      <GaugeChart.Needle variant="triangle" />
      <GaugeChart.Center>
        <GaugeChart.CenterValue />
        <GaugeChart.CenterLabel>NO1 now</GaugeChart.CenterLabel>
      </GaugeChart.Center>
    </GaugeChart.Root>
  );
}
