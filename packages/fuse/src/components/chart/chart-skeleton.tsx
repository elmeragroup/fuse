"use client";

import type { ReactElement } from "react";

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
 * A loading placeholder that renders in place of Root, for example as a Suspense fallback.
 *
 * @beta
 */
export function ChartSkeleton(_props: ChartSkeletonProps): ReactElement {
  return <></>;
}

Object.assign(ChartSkeleton, { displayName: "Chart.Skeleton" });
