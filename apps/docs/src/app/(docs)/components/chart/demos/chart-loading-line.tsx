"use client";

import { Chart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while a line chart's data loads, such as a Suspense fallback. */
export function ChartLoadingLine() {
  return <Chart.Skeleton variant="line" />;
}
