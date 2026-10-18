"use client";

import type { ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
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
 * Props for `RadialChart.Root`, the root of radial bar charts, one ring per row.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TNameKey - The category column, inferred from `nameKey`.
 * @template TValueKey - The value column, inferred from `valueKey`.
 * @beta
 */
export type RadialChartRootProps<
  TRow extends ChartRowOf<TRow> = ChartRow,
  TConfig extends ChartConfig = ChartConfig,
  TNameKey extends ChartCategoryKey<TRow> = ChartCategoryKey<TRow>,
  TValueKey extends ChartSeriesKey<TRow> = ChartSeriesKey<TRow>,
> = ChartAccessibleName &
  ChartFigureProps &
  ChartSelectionProps<keyof TConfig & string> & {
    /** The rows, one per ring, the first outermost. A negative value throws `negative-polar-value`. */
    data: readonly TRow[];
    /**
     * One entry per category, keyed by category value. Each entry is a `ChartSeriesConfig` with
     * `label`, `color` and optionally `format` and `icon`. It takes no `stack`, `projectedFrom`,
     * `qualityKey`, `interval` or `missing`, and its colours are `ChartPolarColor` roles. Root's
     * `qualityKey` names the quality column instead.
     */
    config: TConfig & ChartCategoryConfigCheck<TConfig, TRow[TNameKey]>;
    /** The column that names each ring. */
    nameKey: TNameKey;
    /** The column that fills each ring. */
    valueKey: TValueKey;
    /** The column that holds each ring's `ChartQuality`. */
    qualityKey?: ChartQualityKey<TRow>;
    /** The value format. A category's config `format` overrides it. */
    valueFormat?: ValueFormat;
    /** A fraction of the outer radius where the innermost ring starts, `0.3` by default. */
    innerRadius?: number;
    /** Degrees from 12 o'clock, clockwise, where each ring's sweep starts. 0 by default. */
    startAngle?: number;
    /** Degrees from 12 o'clock, clockwise, where a full ring's sweep ends. 360 by default. */
    endAngle?: number;
    /** The ring that is active before any pointer or key moves. */
    defaultActiveKey?: keyof TConfig & string;
    /** "none" turns the entrance sweep off. */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  } & (
    | {
        /** One maximum for every ring. Without it or `maxKey`, the largest value fills its ring. */
        max?: number;
        /** Not with `max`. */
        maxKey?: never;
      }
    | {
        /** The column that holds each row's own maximum, such as a budget per ring. */
        maxKey: ChartSeriesKey<TRow>;
        /** Not with `maxKey`. */
        max?: never;
      }
  );

/**
 * The root of radial bar charts. Each row fills one ring against its maximum, the first row
 * outermost, and a value past the maximum fills the whole sweep with `data-over-max`.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TNameKey - The category column, inferred from `nameKey`.
 * @template TValueKey - The value column, inferred from `valueKey`.
 * @beta
 */
export function RadialChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TNameKey extends ChartCategoryKey<TRow>,
  TValueKey extends ChartSeriesKey<TRow>,
>(props: RadialChartRootProps<TRow, TConfig, TNameKey, TValueKey>): ReactElement {
  const {
    data: _data,
    config: _config,
    nameKey: _nameKey,
    valueKey: _valueKey,
    qualityKey: _qualityKey,
    valueFormat: _valueFormat,
    innerRadius: _innerRadius,
    startAngle: _startAngle,
    endAngle: _endAngle,
    max: _max,
    maxKey: _maxKey,
    defaultActiveKey: _defaultActiveKey,
    selectedKey: _selectedKey,
    defaultSelectedKey: _defaultSelectedKey,
    onSelectedKeyChange: _onSelectedKeyChange,
    description: _description,
    children,
    ...figure
  } = props;
  return (
    <figure data-slot="radial-chart" {...definedProps(figure)}>
      {children}
    </figure>
  );
}

Object.assign(RadialChartRoot, { displayName: "RadialChart.Root" });
