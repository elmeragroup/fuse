"use client";

import { Chart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while an area chart's data loads, such as a Suspense fallback. */
export function ChartLoadingArea() {
  return <Chart.Skeleton variant="area" />;
}
