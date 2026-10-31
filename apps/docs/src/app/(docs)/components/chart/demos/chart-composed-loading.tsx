"use client";

import { Chart } from "@elmeragroup/fuse/chart";

/** The placeholder a page shows while a composed chart's data loads, such as a Suspense fallback. */
export function ChartComposedLoading() {
  return <Chart.Skeleton variant="bar" />;
}
