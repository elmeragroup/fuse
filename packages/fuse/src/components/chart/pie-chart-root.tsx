"use client";

import type { ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import { ChartPendingRootContext } from "./chart-pending-root";
import type {
  ChartAccessibleName,
  ChartCategoryConfigCheck,
  ChartCategoryKey,
  ChartConfig,
  ChartFigureProps,
  ChartQualityKey,
  ChartRow,
  ChartRowOf,
  ChartSelectionProps,
  ChartSeriesKey,
  ValueFormat,
} from "./chart-types";

/**
 * Props for `PieChart.Root`, the root of pie and donut charts and of gauge pies.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TNameKey - The category column, inferred from `nameKey`.
 * @template TValueKey - The value column, inferred from `valueKey`.
 * @beta
 */
export type PieChartRootProps<
  TRow extends ChartRowOf<TRow> = ChartRow,
  TConfig extends ChartConfig = ChartConfig,
  TNameKey extends ChartCategoryKey<TRow> = ChartCategoryKey<TRow>,
  TValueKey extends ChartSeriesKey<TRow> = ChartSeriesKey<TRow>,
> = ChartAccessibleName &
  ChartFigureProps &
  ChartSelectionProps<keyof TConfig & string> & {
    /** The rows, one per slice, drawn in data order. A negative value throws `negative-polar-value`. */
    data: readonly TRow[];
    /**
     * One entry per category, keyed by category value. Each entry is a `ChartSeriesConfig` with
     * `label`, `color` and optionally `format` and `icon`. It takes no `stack`, `projectedFrom`,
     * `qualityKey`, `interval` or `missing`, and its colours are `ChartPolarColor` roles. Root's
     * `qualityKey` names the quality column instead.
     */
    config: TConfig & ChartCategoryConfigCheck<TConfig, TRow[TNameKey]>;
    /** The column that names each slice. */
    nameKey: TNameKey;
    /** The column that sizes each slice. */
    valueKey: TValueKey;
    /** The column that holds each slice's `ChartQuality`. */
    qualityKey?: ChartQualityKey<TRow>;
    /** The value format. A category's config `format` overrides it. */
    valueFormat?: ValueFormat;
    /** A fraction of the outer radius. 0, the default, draws a pie, and the Figma donut uses 0.62. */
    innerRadius?: number;
    /** Degrees between slices. A negative value overlaps neighbours. */
    padAngle?: number;
    /** Degrees from 12 o'clock, clockwise, where the first slice starts. 0 by default. */
    startAngle?: number;
    /** Degrees from 12 o'clock, clockwise, where the last slice ends. 360 by default. */
    endAngle?: number;
    /** Turns the sweep into a gauge, where slices fill their total's share of `max`. */
    max?: number;
    /** The most slices drawn, 6 by default. Past it the smallest rows fold into one Other slice. */
    maxSlices?: number;
    /** The Other slice's label. The dictionary's "Annet" is the default. */
    otherLabel?: string;
    /** The slice that is active before any pointer or key moves. A folded category activates Other. */
    defaultActiveKey?: keyof TConfig & string;
    /** "none" turns the entrance sweep off. */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/**
 * The root of pie and donut charts. Slices draw in data order from 12 o'clock, clockwise, and past
 * `maxSlices` the smallest rows fold into one Other slice.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TNameKey - The category column, inferred from `nameKey`.
 * @template TValueKey - The value column, inferred from `valueKey`.
 * @beta
 */
export function PieChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TNameKey extends ChartCategoryKey<TRow>,
  TValueKey extends ChartSeriesKey<TRow>,
>(props: PieChartRootProps<TRow, TConfig, TNameKey, TValueKey>): ReactElement {
  const {
    data: _data,
    config: _config,
    nameKey: _nameKey,
    valueKey: _valueKey,
    qualityKey: _qualityKey,
    valueFormat: _valueFormat,
    innerRadius: _innerRadius,
    padAngle: _padAngle,
    startAngle: _startAngle,
    endAngle: _endAngle,
    max: _max,
    maxSlices: _maxSlices,
    otherLabel: _otherLabel,
    defaultActiveKey: _defaultActiveKey,
    selectedKey: _selectedKey,
    defaultSelectedKey: _defaultSelectedKey,
    onSelectedKeyChange: _onSelectedKeyChange,
    description: _description,
    children,
    ...figure
  } = props;
  // Until the polar layer gives this Root a readout of its own, the shared parts inside it render
  // nothing, and every other child renders as written.
  return (
    <figure data-slot="pie-chart" {...definedProps(figure)}>
      <ChartPendingRootContext value>{children}</ChartPendingRootContext>
    </figure>
  );
}

Object.assign(PieChartRoot, { displayName: "PieChart.Root" });
