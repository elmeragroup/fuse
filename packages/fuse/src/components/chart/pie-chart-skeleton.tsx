"use client";

import type { ReactElement } from "react";

import { Skeleton } from "../skeleton/skeleton";
import { ChartSkeletonBody } from "./chart-skeleton-body";
import type { ChartDomProps } from "./chart-types";

/**
 * Props for `PieChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type PieChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The hole as a fraction of the outer radius. Pass Root's `innerRadius`. */
  innerRadius?: number;
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * A loading placeholder that renders in place of `PieChart.Root`, for example as a Suspense fallback.
 * One Fuse Skeleton disc, with the Root's hole for a donut, sketches the pie, and one Fuse Loader
 * names the wait.
 *
 * @beta
 */
export function PieChartSkeleton({ innerRadius = 0, label, ...props }: PieChartSkeletonProps): ReactElement {
  return (
    <ChartSkeletonBody
      variant="pie"
      label={label}
      marks={<Skeleton data-slot="chart-skeleton-mark" style={{ "--chart-skeleton-hole": innerRadius }} />}
      {...props}
    />
  );
}

Object.assign(PieChartSkeleton, { displayName: "PieChart.Skeleton" });
