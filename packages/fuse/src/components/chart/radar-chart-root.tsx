"use client";

import type { ReactElement, ReactNode } from "react";

import { definedProps } from "../../internal/defined-props";
import { ChartPendingRootContext } from "./chart-pending-root";
import type {
  ChartAccessibleName,
  ChartCategoryKey,
  ChartConfig,
  ChartFigureProps,
  ChartRadarCap,
  ChartRadarFieldCheck,
  ChartRow,
  ChartRowOf,
  ChartSelectionProps,
  ChartSeriesConfigCheck,
} from "./chart-types";

/**
 * Props for `RadarChart.Root`, the root of radar charts, one spoke per row.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TNameKey - The spoke column, inferred from `nameKey`.
 * @beta
 */
export type RadarChartRootProps<
  TRow extends ChartRowOf<TRow> = ChartRow,
  TConfig extends ChartConfig = ChartConfig,
  TNameKey extends ChartCategoryKey<TRow> = ChartCategoryKey<TRow>,
> = ChartAccessibleName &
  ChartFigureProps &
  ChartSelectionProps<keyof TConfig & string> & {
    /** The rows, one per spoke. Negative values draw inside a zero ring. */
    data: readonly TRow[];
    /**
     * Keyed by series, as in `Chart.Root`. Each entry is a `ChartSeriesConfig` with `label`,
     * `color` and optionally `format`, `icon`, `missing` and `qualityKey`. A fifth literal key fails
     * the type, and a fifth runtime key throws. It takes no `stack`, `projectedFrom`, `interval` or
     * scale.
     */
    config: TConfig &
      ChartSeriesConfigCheck<TConfig, TRow> &
      ChartRadarFieldCheck<TConfig> &
      ChartRadarCap<TConfig>;
    /** The column that names each spoke. */
    nameKey: TNameKey;
    /**
     * The radius maximum. The niced maximum of the data is the default. A `max` at or above the
     * data maximum ends the domain at `max`, and when the data exceeds `max` the niced data maximum
     * wins, so no reading is clamped. The centre is 0, or the niced minimum when a value is negative,
     * and then the grid draws a zero ring.
     */
    max?: number;
    /** The spoke that is active before any pointer or key moves. */
    defaultActiveName?: TRow[TNameKey];
    /** "none" turns the entrance off. */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/**
 * The root of radar charts, which draw at most 4 series over one spoke per row.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TNameKey - The spoke column, inferred from `nameKey`.
 * @beta
 */
export function RadarChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TNameKey extends ChartCategoryKey<TRow>,
>(props: RadarChartRootProps<TRow, TConfig, TNameKey>): ReactElement {
  const {
    data: _data,
    config: _config,
    nameKey: _nameKey,
    max: _max,
    defaultActiveName: _defaultActiveName,
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
    <figure data-slot="radar-chart" {...definedProps(figure)}>
      <ChartPendingRootContext value>{children}</ChartPendingRootContext>
    </figure>
  );
}

Object.assign(RadarChartRoot, { displayName: "RadarChart.Root" });
