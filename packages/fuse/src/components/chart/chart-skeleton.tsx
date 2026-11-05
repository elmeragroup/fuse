"use client";

import type { ReactElement } from "react";

import { Loader } from "../loader/loader";
import { Skeleton } from "../skeleton/skeleton";
import { ChartSkeletonBody } from "./chart-skeleton-body";
import type { ChartDomProps } from "./chart-types";

/**
 * Props for `Chart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type ChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The mark the placeholder sketches. "bar" by default. */
  variant?: "bar" | "line" | "area";
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * The bar heights of the placeholder in percent of the plot, 12 bars between 20 and 80 %. The list
 * is fixed, so the server and the client agree.
 */
const SKELETON_BARS = [42, 64, 35, 78, 52, 30, 68, 46, 74, 38, 58, 26] as const;

/**
 * A loading placeholder that renders in place of Root, for example as a Suspense fallback. Its
 * marks are Fuse Skeleton shapes that readers skip, and one Fuse Loader names the wait.
 *
 * @beta
 */
export function ChartSkeleton({ variant = "bar", label, ...props }: ChartSkeletonProps): ReactElement {
  return (
    <ChartSkeletonBody
      variant={variant}
      label={label}
      marks={
        variant === "bar" ? (
          SKELETON_BARS.map((height, index) => (
            <Skeleton
              // The bars never reorder, so the position is their identity.
              key={index}
              data-slot="chart-skeleton-mark"
              style={{ "--chart-skeleton-height": `${String(height)}%` }}
            />
          ))
        ) : (
          <Skeleton data-slot="chart-skeleton-mark" />
        )
      }
      {...props}
    />
  );
}

/**
 * The plot's placeholder inside a Root or a Panel, from the server render until the browser
 * measures the plot and draws the marks. It is a Fuse Loader in the plot's middle, which CSS keeps
 * hidden for a moment, so a fast hydration shows nothing. Root never reads its children, so it
 * sketches no mark of its own, and the axes, the legend and the table around it are already
 * final. Each chart already has its name and its table, so the wait is not announced.
 */
export function PlotLoader(): ReactElement {
  return <Loader aria-hidden="true" label="" />;
}

Object.assign(ChartSkeleton, { displayName: "Chart.Skeleton" });
