"use client";

import type { ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import type {
  ChartAccessibleName,
  ChartChangeEventDetails,
  ChartConfig,
  ChartFigureProps,
  ChartIntro,
  ChartRow,
  ChartRowOf,
  ChartSelectionProps,
  ChartSeriesConfigCheck,
  ChartTimeAxisProps,
  ChartXKey,
  ChartXOut,
  ChartXRange,
  ChartXRangeChangeReason,
  ChartXValue,
} from "./chart-types";

/**
 * Props for `Chart.Root`, the root of every cartesian chart.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 * @beta
 */
export type ChartRootProps<
  TRow extends ChartRowOf<TRow> = ChartRow,
  TConfig extends ChartConfig = ChartConfig,
  TXKey extends ChartXKey<TRow> = ChartXKey<TRow>,
> = ChartAccessibleName &
  ChartFigureProps &
  ChartSelectionProps<keyof TConfig & string> &
  ChartTimeAxisProps<TRow[TXKey]> & {
    /** The rows, one per slot or category. Every cell is serialisable, so a server component passes it. */
    data: readonly TRow[];
    /**
     * One entry per series, keyed by the number column it reads. Each entry is a `ChartSeriesConfig`
     * with a required `label` and `color` and an optional `format`, `icon`, `stack`, `missing`,
     * `projectedFrom`, `qualityKey` and `interval`. Write it `as const satisfies ChartConfig`, so a misspelt literal
     * `qualityKey` fails the type.
     */
    config: TConfig & ChartSeriesConfigCheck<TConfig, TRow>;
    /**
     * The x column. It names a column with no null values. A `Date` or epoch-milliseconds column
     * makes a time axis, which needs `interval`, and a string column makes a category axis in data
     * order.
     */
    xKey: TXKey;
    /** "band" by default. Line and area charts usually pass "point". */
    xScale?: "band" | "point";
    /**
     * "horizontal" draws the x column down the left edge and values left to right, for horizontal
     * bars. Axes keep their data roles in both orientations, so `XAxis` is always the `xKey` axis and
     * `YAxis` always the value axis. Each category row is `--chart-row-height` tall.
     */
    orientation?: "vertical" | "horizontal";
    /** "diverging" by default, so negative values stack below zero. */
    stackOffset?: "diverging" | "expand";
    /**
     * "zero" by default. "none" lets a Line-only layout leave 0 out, and Bar and Area throw under it.
     * It governs the default layout only. Each Panel takes its own.
     */
    yBaseline?: "zero" | "none";
    /** Values the default layout's y domain must reach, such as a price cap. Each Panel takes its own. */
    yInclude?: readonly number[];
    /**
     * The first and last slot of the brushed window, both inclusive. Prefer the uncontrolled
     * `defaultXRange` with `onXRangeCommitted`, because a controlled range renders every series on
     * each brush step.
     */
    xRange?: ChartXRange<TRow[TXKey]>;
    /** The brushed window on first render. */
    defaultXRange?: ChartXRange<TRow[TXKey]>;
    /** Called on every brush step with the first and last slot. A data update never calls it. */
    onXRangeChange?: (
      range: readonly [first: ChartXOut<TRow[TXKey]>, last: ChartXOut<TRow[TXKey]>],
      details: ChartChangeEventDetails<ChartXRangeChangeReason>
    ) => void;
    /** Called once when a brush drag, track press or key press ends. Fetch new data here. */
    onXRangeCommitted?: (
      range: readonly [first: ChartXOut<TRow[TXKey]>, last: ChartXOut<TRow[TXKey]>],
      details: ChartChangeEventDetails<ChartXRangeChangeReason>
    ) => void;
    /** The slot that is active before any pointer or key moves. An x survives a reload where an index would not. */
    defaultActiveX?: ChartXValue<TRow[TXKey]>;
    /**
     * The entrance wipe origin, physical under `dir="rtl"` too. "none" turns the entrance off. The
     * entrance runs once, when Root mounts. A mark that mounts later, after a data update or a brush
     * step, snaps into place.
     */
    "data-intro"?: ChartIntro;
    /** "past" fades marks whose slot ended before `now`. */
    "data-fade"?: "past";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/**
 * The root of every cartesian chart, also exported as `AreaChart.Root`, `BarChart.Root` and
 * `LineChart.Root`. It reads the series from `config`, never from its children, and renders a
 * named `figure`.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The x column, inferred from `xKey`.
 * @beta
 */
export function ChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TXKey extends ChartXKey<TRow>,
>(props: ChartRootProps<TRow, TConfig, TXKey>): ReactElement {
  const {
    data: _data,
    config: _config,
    xKey: _xKey,
    xScale: _xScale,
    orientation: _orientation,
    stackOffset: _stackOffset,
    yBaseline: _yBaseline,
    yInclude: _yInclude,
    xRange: _xRange,
    defaultXRange: _defaultXRange,
    onXRangeChange: _onXRangeChange,
    onXRangeCommitted: _onXRangeCommitted,
    defaultActiveX: _defaultActiveX,
    selectedKey: _selectedKey,
    defaultSelectedKey: _defaultSelectedKey,
    onSelectedKeyChange: _onSelectedKeyChange,
    interval: _interval,
    period: _period,
    now: _now,
    timeZone: _timeZone,
    xFormat: _xFormat,
    description: _description,
    children,
    ...figure
  } = props;
  return (
    <figure data-slot="chart" {...definedProps(figure)}>
      {children}
    </figure>
  );
}

Object.assign(ChartRoot, { displayName: "Chart.Root" });
