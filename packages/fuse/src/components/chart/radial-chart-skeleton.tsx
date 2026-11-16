"use client";

import type { ReactElement } from "react";

import { Skeleton } from "../skeleton/skeleton";
import { ChartSkeletonBody } from "./chart-skeleton-body";
import type { ChartDomProps } from "./chart-types";

/**
 * Props for `RadialChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type RadialChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The fraction of the outer radius where the innermost ring starts. Pass Root's `innerRadius`. */
  innerRadius?: number;
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * A loading placeholder that renders in place of `RadialChart.Root`, for example as a Suspense
 * fallback. One Fuse Skeleton annulus from the Root's hole to the rim sketches the rings, and one
 * Fuse Loader names the wait.
 *
 * @beta
 */
export function RadialChartSkeleton({
  innerRadius = 0.3,
  label,
  ...props
}: RadialChartSkeletonProps): ReactElement {
  return (
    <ChartSkeletonBody
      variant="radial"
      label={label}
      marks={<Skeleton data-slot="chart-skeleton-mark" style={{ "--chart-skeleton-hole": innerRadius }} />}
      {...props}
    />
  );
}

Object.assign(RadialChartSkeleton, { displayName: "RadialChart.Skeleton" });
