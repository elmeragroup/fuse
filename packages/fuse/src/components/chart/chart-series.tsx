"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useChartRoot } from "./chart-context";
import { isThresholdColor, seriesPaintOf, valuePaint } from "./chart-paint";
import type { SeriesPaint } from "./chart-paint";
import { usePendingOr } from "./chart-pending-root";
import { readingAt, useActivePoint, useLegendSide, useReadoutKey } from "./chart-readout";
import type { ThresholdSideName } from "./chart-readout";
import { seriesLabel } from "./chart-text";
import type { ChartDomProps } from "./chart-types";
import { barForm, drawnBarVariant } from "./layout/bar-geometry";
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
 * gradient, a scale its 7-step ramp and a threshold its two sides split in half, lower side first.
 * A step the active value or a legend entry's side picks paints alone.
 */
function swatchPaint(paint: SeriesPaint, step: string | undefined): string {
  if (step !== undefined) return step;
  const { stops, ramp } = paint;
  if (stops !== undefined) return `linear-gradient(to right, ${stops.join(", ")})`;
  if (ramp === undefined) return paint.base;
  if (!isThresholdColor(paint.color)) return `linear-gradient(to right, ${ramp.join(", ")})`;
  const [below = paint.base, above = paint.base] = ramp;
  return `linear-gradient(to right, ${below} 50%, ${above} 50%)`;
}

/** The paint of a threshold side, which a threshold's ramp holds lower side first. */
function sidePaint(paint: SeriesPaint, side: ThresholdSideName | null): string | undefined {
  if (side === null || !isThresholdColor(paint.color)) return undefined;
  return paint.ramp?.[side === "above" ? 1 : 0];
}

/**
 * The series' paint. A role list shows the list as a gradient, a scale shows its ramp, and a
 * threshold shows its two sides split in half. Inside a tooltip row a scale or a threshold series
 * shows the step of the active value, and inside a threshold series' legend entry it shows the
 * entry's side. The swatch is decoration, so it is hidden from screen readers.
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
  const side = useLegendSide(key);
  const reading =
    point.slot === null || paint.bins === undefined ? null : readingAt(context, key, point.slot);
  const step =
    sidePaint(paint, side) ?? (reading?.kind === "reading" ? valuePaint(paint, reading.value) : undefined);
  // The swatch wears the look the series' bars draw in, from config at render time, so the server
  // HTML and the legend tell a hatched series apart before the chart hydrates.
  const look = drawnBarVariant(
    context.config[key]?.barVariant ?? "default",
    barForm(context.model, context.orientation)
  );
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-swatch",
      "data-variant": variant,
      "data-series": series?.seriesIndex,
      "data-series-variant": look === "default" ? undefined : look,
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
 * The series' visible label from config. Inside a threshold series' legend entry it is the entry's
 * side label, and everywhere else, the tooltip row included, the series' own `label`.
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
  const side = useLegendSide(key);
  const color = key === null ? undefined : context.config[key]?.color;
  const text =
    key === null
      ? null
      : side !== null && color !== undefined && isThresholdColor(color)
        ? color[side].label
        : seriesLabel(context, key).text;
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-series-label",
      ...mergeProps<"span">({ className, children: text }, props),
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
