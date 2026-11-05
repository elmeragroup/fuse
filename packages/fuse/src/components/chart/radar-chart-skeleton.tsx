"use client";

import type { ReactElement } from "react";

import { Skeleton } from "../skeleton/skeleton";
import { ChartSkeletonBody } from "./chart-skeleton-body";
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
 * A loading placeholder that renders in place of `RadarChart.Root`, for example as a Suspense
 * fallback. One Fuse Skeleton hexagon sketches the polygons, and one Fuse Loader names the wait.
 *
 * @beta
 */
export function RadarChartSkeleton({ label, ...props }: RadarChartSkeletonProps): ReactElement {
  return (
    <ChartSkeletonBody
      variant="radar"
      label={label}
      marks={<Skeleton data-slot="chart-skeleton-mark" />}
      {...props}
    />
  );
}

Object.assign(RadarChartSkeleton, { displayName: "RadarChart.Skeleton" });
