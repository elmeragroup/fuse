"use client";

import type { ReactElement } from "react";

import { Skeleton } from "../skeleton/skeleton";
import { ChartSkeletonBody } from "./chart-skeleton-body";
import type { ChartDomProps } from "./chart-types";

/**
 * Props for `ClockChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type ClockChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * A loading placeholder that renders in place of `ClockChart.Root`, for example as a Suspense
 * fallback. One Fuse Skeleton annulus sketches the dial, and one Fuse Loader names the wait.
 *
 * @beta
 */
export function ClockChartSkeleton({ label, ...props }: ClockChartSkeletonProps): ReactElement {
  return (
    <ChartSkeletonBody
      variant="clock"
      label={label}
      marks={<Skeleton data-slot="chart-skeleton-mark" />}
      {...props}
    />
  );
}

Object.assign(ClockChartSkeleton, { displayName: "ClockChart.Skeleton" });
