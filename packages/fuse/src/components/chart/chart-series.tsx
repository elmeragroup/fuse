"use client";

import { use } from "react";
import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { ChartPendingRootContext, useChartRoot } from "./chart-context";
import { readingAt, useActivePoint, useReadoutKey } from "./chart-readout";
import { seriesLabel } from "./chart-text";
import type { ChartColor, ChartDomProps } from "./chart-types";
import { colorBins } from "./layout/color-bins";
import { escapeColorKey } from "./layout/color-key";

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

const SCALE_STEPS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Whether a colour is a decorative role list. */
function isRoleList(color: ChartColor): color is Extract<ChartColor, readonly unknown[]> {
  return Array.isArray(color);
}

/**
 * The CSS paint of a swatch. A role paints itself, a role list paints its roles as a gradient, and
 * a scale paints its 7-step ramp, or one step when the active value picks it. A consumer's
 * `--chart-color-<key>` wins over a role.
 */
function swatchPaint(key: string, color: ChartColor, step: number | undefined): string {
  const own = `--chart-color-${escapeColorKey(key)}`;
  if (isRoleList(color))
    return `linear-gradient(to right, ${color.map((role) => `var(--${role})`).join(", ")})`;
  if (color === "chart-seq" || color === "chart-diverging") {
    if (step !== undefined) return `var(--${color}-${String(step)})`;
    return `linear-gradient(to right, ${SCALE_STEPS.map((index) => `var(--${color}-${String(index)})`).join(", ")})`;
  }
  return `var(${own}, var(--${color}))`;
}

/**
 * The series' paint. A role list shows the list as a gradient, and a scale shows its ramp. Inside a
 * tooltip row a scale series shows the step of the active value. The swatch is decoration, so it is
 * hidden from screen readers.
 *
 * @beta
 */
export function ChartSwatch(props: ChartSwatchProps): ReactElement {
  return use(ChartPendingRootContext) ? <></> : <ChartSwatchBody {...props} />;
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
  const color = context.config[key]?.color ?? "chart-1";
  let step: number | undefined;
  if (point.slot !== null && (color === "chart-seq" || color === "chart-diverging")) {
    const reading = readingAt(context, key, point.slot);
    const values = (context.model.series.find((series) => series.key === key)?.readings ?? []).flatMap(
      (entry) => (entry.kind === "reading" ? [entry.value] : [])
    );
    if (reading?.kind === "reading") step = colorBins(color, values)(reading.value);
  }
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-swatch",
      "data-variant": variant,
      "data-series": context.model.series.find((series) => series.key === key)?.seriesIndex,
      ...mergeProps<"span">(
        {
          "aria-hidden": true,
          className,
          style: { "--chart-swatch-paint": swatchPaint(key, color, step), ...style },
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
  return use(ChartPendingRootContext) ? <></> : <ChartSeriesLabelBody {...props} />;
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
  return use(ChartPendingRootContext) ? <></> : <ChartSeriesIconBody {...props} />;
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
