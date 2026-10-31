"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useChartRoot } from "./chart-context";
import { seriesPaintOf, valuePaint } from "./chart-paint";
import type { SeriesPaint } from "./chart-paint";
import { usePendingOr } from "./chart-pending-root";
import { readingAt, useActivePoint, useReadoutKey } from "./chart-readout";
import { useChartStore } from "./chart-store";
import { seriesLabel } from "./chart-text";
import type { ChartDomProps } from "./chart-types";
import { seriesOf } from "./layout/series-of";

/**
 * Props for `Chart.Swatch`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartSwatchProps = ChartDomProps<"span"> & {
  /** The series to paint. Inside a template row the row supplies it. */
  dataKey?: string;
  /** The swatch's shape. "square" by default. */
  variant?: "square" | "circle" | "square-outline" | "circle-outline" | "line" | "bar";
};

/**
 * Props for `Chart.SeriesLabel`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartSeriesLabelProps = ChartDomProps<"span"> & {
  /** The series to name. Inside a template row the row supplies it. */
  dataKey?: string;
};

/**
 * Props for `Chart.SeriesIcon`, a `span` with Base UI's `render`.
 *
 * @beta
 */
export type ChartSeriesIconProps = ChartDomProps<"span"> & {
  /** The series whose config `icon` to show. Inside a template row the row supplies it. */
  dataKey?: string;
};

/**
 * The CSS paint of a swatch, the marks' own stops: a role paints itself, a role list its roles as a
 * gradient, and a scale its 7-step ramp, or one step when the active value picks it.
 */
function swatchPaint(paint: SeriesPaint, step: string | undefined): string {
  if (step !== undefined) return step;
  const stops = paint.stops ?? paint.ramp;
  return stops === undefined ? paint.base : `linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * The series' paint. A role list shows the list as a gradient, and a scale shows its ramp. Inside a
 * tooltip row a scale series shows the step of the active value. The swatch is decoration, so it is
 * hidden from screen readers.
 *
 * @beta
 */
export function ChartSwatch(props: ChartSwatchProps): ReactElement {
  return usePendingOr(props, ChartSwatchBody);
}

function ChartSwatchBody({
  dataKey,
  variant = "square",
  render,
  className,
  style,
  ...props
}: ChartSwatchProps): ReactElement {
  const context = useChartRoot("Chart.Swatch");
  const point = useActivePoint(context);
  const key =
    useReadoutKey("Chart.Swatch", context, dataKey, point.key) ?? Object.keys(context.config)[0] ?? "";
  const series = seriesOf(context.model, key);
  const paint = seriesPaintOf(key, context.config[key]?.color ?? "chart-1", series);
  const reading =
    point.slot === null || paint.bins === undefined ? null : readingAt(context, key, point.slot);
  const step = reading?.kind === "reading" ? valuePaint(paint, reading.value) : undefined;
  // A hatched series draws its legend swatch hatched too, so the legend tells the series apart.
  const hatched = useChartStore(context.store, (snapshot) => snapshot.hatched.includes(key));
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-swatch",
      "data-variant": variant,
      "data-series": series?.seriesIndex,
      "data-hatched": hatched ? "" : undefined,
      ...mergeProps<"span">(
        {
          "aria-hidden": true,
          className,
          style: { "--chart-swatch-paint": swatchPaint(paint, step), ...style },
        },
        props
      ),
    },
  });
}

/**
 * The series' visible label from config.
 *
 * @beta
 */
export function ChartSeriesLabel(props: ChartSeriesLabelProps): ReactElement {
  return usePendingOr(props, ChartSeriesLabelBody);
}

function ChartSeriesLabelBody({ dataKey, render, className, ...props }: ChartSeriesLabelProps): ReactElement {
  const context = useChartRoot("Chart.SeriesLabel");
  const point = useActivePoint(context);
  const key = useReadoutKey("Chart.SeriesLabel", context, dataKey, point.key);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-series-label",
      ...mergeProps<"span">(
        { className, children: key === null ? null : seriesLabel(context, key).text },
        props
      ),
    },
  });
}

/**
 * The series' config `icon`, or nothing when it has none. The icon is decoration, because the
 * label beside it names the series.
 *
 * @beta
 */
export function ChartSeriesIcon(props: ChartSeriesIconProps): ReactElement {
  return usePendingOr(props, ChartSeriesIconBody);
}

function ChartSeriesIconBody({ dataKey, render, className, ...props }: ChartSeriesIconProps): ReactElement {
  const context = useChartRoot("Chart.SeriesIcon");
  const point = useActivePoint(context);
  const key = useReadoutKey("Chart.SeriesIcon", context, dataKey, point.key);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-series-icon",
      ...mergeProps<"span">(
        { "aria-hidden": true, className, children: key === null ? null : context.config[key]?.icon },
        props
      ),
    },
  });
}

Object.assign(ChartSwatch, { displayName: "Chart.Swatch" });
Object.assign(ChartSeriesLabel, { displayName: "Chart.SeriesLabel" });
Object.assign(ChartSeriesIcon, { displayName: "Chart.SeriesIcon" });
