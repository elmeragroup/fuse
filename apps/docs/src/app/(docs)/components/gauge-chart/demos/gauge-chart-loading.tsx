"use client";

import { GaugeChart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while the reading loads, such as a Suspense fallback. */
export function GaugeChartLoading() {
  return <GaugeChart.Skeleton />;
}
