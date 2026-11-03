"use client";

import type { ReactElement } from "react";

import type { ChartDomProps } from "./chart-types";

/**
 * Props for `PieChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type PieChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** A fraction of the outer radius, as on Root. 0 by default. */
  innerRadius?: number;
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * A loading placeholder that renders in place of `PieChart.Root`, for example as a Suspense fallback.
 *
 * @beta
 */
export function PieChartSkeleton(_props: PieChartSkeletonProps): ReactElement {
  return <></>;
}

Object.assign(PieChartSkeleton, { displayName: "PieChart.Skeleton" });
