"use client";

import { RadarChart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while the chart's data loads, such as a Suspense fallback. */
export function RadarChartLoading() {
  return <RadarChart.Skeleton />;
}
