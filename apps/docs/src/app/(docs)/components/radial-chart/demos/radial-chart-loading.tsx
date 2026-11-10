"use client";

import { RadialChart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while the chart's data loads, such as a Suspense fallback. */
export function RadialChartLoading() {
  return <RadialChart.Skeleton />;
}
