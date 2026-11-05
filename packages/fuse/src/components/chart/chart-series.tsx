"use client";

import type { ReactElement } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { usePendingOr } from "./chart-pending-root";
import { useActiveItem, useChartReadout, useLegendSide, useReadoutKey } from "./chart-readout";
import type { ChartDomProps } from "./chart-types";
import { seriesPaint } from "./layout/color-key";

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
  const readout = useChartReadout("Chart.Swatch");
  const point = useActiveItem(readout);
  const key = useReadoutKey("Chart.Swatch", readout, dataKey, point.key) ?? readout.legendKeys[0] ?? "";
  const side = useLegendSide(key);
  const { paint, look } = readout.swatch(key, point.index);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-swatch",
      "data-variant": variant,
      "data-series": readout.item(key)?.index,
      "data-series-variant": look,
      ...mergeProps<"span">(
        {
          "aria-hidden": true,
          className,
          // A legend entry's side paints its role with the consumer override first, as the
          // series' marks do.
          style: { "--chart-swatch-paint": side === null ? paint : seriesPaint(key, side.color), ...style },
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
  const readout = useChartReadout("Chart.SeriesLabel");
  const point = useActiveItem(readout);
  const key = useReadoutKey("Chart.SeriesLabel", readout, dataKey, point.key);
  const side = useLegendSide(key);
  const text = key === null ? null : (side?.label ?? readout.item(key)?.label.text ?? key);
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
  const readout = useChartReadout("Chart.SeriesIcon");
  const point = useActiveItem(readout);
  const key = useReadoutKey("Chart.SeriesIcon", readout, dataKey, point.key);
  return useRender({
    defaultTagName: "span",
    render,
    props: {
      "data-slot": "chart-series-icon",
      ...mergeProps<"span">(
        { "aria-hidden": true, className, children: key === null ? null : readout.item(key)?.icon },
        props
      ),
    },
  });
}

Object.assign(ChartSwatch, { displayName: "Chart.Swatch" });
Object.assign(ChartSeriesLabel, { displayName: "Chart.SeriesLabel" });
Object.assign(ChartSeriesIcon, { displayName: "Chart.SeriesIcon" });
