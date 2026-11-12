"use client";

/**
 * A gauge's loading and empty states: a sketch of the dial in place of Root, and Fuse Empty in the
 * cell while Root has no reading.
 */
import type { ReactElement } from "react";

import { Skeleton } from "../skeleton/skeleton";
import { ChartEmptyBody } from "./chart-empty-body";
import { useGaugeContext } from "./chart-gauge-context";
import { ChartSkeletonBody } from "./chart-skeleton-body";
import type { ChartDomProps } from "./chart-types";
import { GAUGE_RADII, GAUGE_SWEEP } from "./layout/gauge";
import { boxPercent, parseSweep, sweepBox } from "./layout/polar-angle";

/**
 * Props for `GaugeChart.Skeleton`, a `div` without `render` or children.
 *
 * @beta
 */
export type GaugeChartSkeletonProps = Omit<ChartDomProps<"div">, "children" | "render"> & {
  /** The sweep's start, as on Root. −135 by default. A non-finite angle throws `invalid-sweep`. */
  startAngle?: number;
  /** The sweep's end, as on Root. 135 by default. */
  endAngle?: number;
  /** The loader's name. The dictionary's "Laster diagram" is the default. */
  label?: string;
};

/**
 * Props for `GaugeChart.Empty`, a `div` with Base UI's `render`.
 *
 * @beta
 */
export type GaugeChartEmptyProps = ChartDomProps<"div">;

/**
 * A loading placeholder that renders in place of `GaugeChart.Root`, for example as a Suspense
 * fallback. One Fuse Skeleton band sketches the track over Root's sweep, in the box Root keeps, and
 * one Fuse Loader names the wait.
 *
 * @beta
 */
export function GaugeChartSkeleton({
  startAngle,
  endAngle,
  label,
  style,
  ...props
}: GaugeChartSkeletonProps): ReactElement {
  const sweep = parseSweep(
    "GaugeChart.Skeleton",
    startAngle ?? GAUGE_SWEEP.startAngle,
    endAngle ?? GAUGE_SWEEP.endAngle
  );
  const box = sweepBox(sweep);
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const percent = (value: number): string => `${(value * 100).toFixed(3)}%`;
  const [left, top] = boxPercent(box, -1, -1);
  return (
    <ChartSkeletonBody
      variant="gauge"
      label={label}
      marks={<Skeleton data-slot="chart-skeleton-mark" />}
      style={{
        "--chart-skeleton-hole": GAUGE_RADII.notchInner,
        "--_aspect": `${String(width)} / ${String(height)}`,
        "--_left": left,
        "--_top": top,
        "--_width": percent(2 / width),
        "--_height": percent(2 / height),
        "--_from": `${String(sweep.direction === 1 ? sweep.start : sweep.end)}deg`,
        "--_sweep": `${String(sweep.width)}deg`,
        ...style,
      }}
      {...props}
    />
  );
}

/**
 * Fuse Empty in the cell while Root's value is null. Its default children are the dictionary's
 * "Ingen data for perioden". While Root has a reading it renders nothing.
 *
 * @beta
 */
export function GaugeChartEmpty(props: GaugeChartEmptyProps): ReactElement {
  const { model } = useGaugeContext("GaugeChart.Empty");
  return <ChartEmptyBody locale={model.locale} empty={model.reading.kind === "empty"} {...props} />;
}

Object.assign(GaugeChartSkeleton, { displayName: "GaugeChart.Skeleton" });
Object.assign(GaugeChartEmpty, { displayName: "GaugeChart.Empty" });
