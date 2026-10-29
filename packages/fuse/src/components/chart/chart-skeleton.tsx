"use client";

import type { ReactElement } from "react";

import { useLocale } from "../../intl/locale-context";
import { Loader } from "../loader/loader";
import { Skeleton } from "../skeleton/skeleton";
import type { ChartDomProps } from "./chart-types";
import { CHART_STRINGS } from "./format/chart-strings";

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
 * The bar heights of the placeholder in percent of the plot, 12 bars as evilcharts' loading state
 * draws them between 20 and 80 %. The list is fixed, so the server and the client agree.
 */
const SKELETON_BARS = [42, 64, 35, 78, 52, 30, 68, 46, 74, 38, 58, 26] as const;

/**
 * A loading placeholder that renders in place of Root, for example as a Suspense fallback. Its
 * marks are Fuse Skeleton shapes that readers skip, and one Fuse Loader names the wait.
 *
 * @beta
 */
export function ChartSkeleton({
  variant = "bar",
  label,
  className,
  style,
  ...props
}: ChartSkeletonProps): ReactElement {
  const { locale } = useLocale();
  return (
    <div data-slot="chart-skeleton" data-variant={variant} className={className} style={style} {...props}>
      {variant === "bar" ? (
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
      )}
      <Loader aria-label={label ?? CHART_STRINGS[locale].loading} />
    </div>
  );
}

Object.assign(ChartSkeleton, { displayName: "Chart.Skeleton" });
