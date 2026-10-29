"use client";

import { BarChart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while the chart's data loads, such as a Suspense fallback. */
export function BarChartLoading() {
  return <BarChart.Skeleton variant="bar" />;
}
