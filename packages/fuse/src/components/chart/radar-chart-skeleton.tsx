"use client";

import type { ReactElement } from "react";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `RadarChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type RadarChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * A loading placeholder that renders in place of `RadarChart.Root`, for example as a Suspense fallback.
 *
 * @beta
 */
export function RadarChartSkeleton(_props: RadarChartSkeletonProps): ReactElement {
  return <></>;
}

Object.assign(RadarChartSkeleton, { displayName: "RadarChart.Skeleton" });
