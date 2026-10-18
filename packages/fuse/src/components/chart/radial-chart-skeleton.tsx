"use client";

import type { ReactElement } from "react";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `RadialChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type RadialChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** A fraction of the outer radius, as on Root. */
  innerRadius?: number;
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * A loading placeholder that renders in place of `RadialChart.Root`, for example as a Suspense fallback.
 *
 * @beta
 */
export function RadialChartSkeleton(_props: RadialChartSkeletonProps): ReactElement {
  return <></>;
}

Object.assign(RadialChartSkeleton, { displayName: "RadialChart.Skeleton" });
