"use client";

import { PieChart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while the chart's data loads, such as a Suspense fallback. */
export function PieChartLoading() {
  return <PieChart.Skeleton innerRadius={0.62} />;
}
