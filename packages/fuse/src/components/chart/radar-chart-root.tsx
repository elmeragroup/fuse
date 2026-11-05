"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import type { PolarIssue } from "./chart-polar-context";
import { PolarRoot } from "./chart-polar-root";
import { radarModel, RADAR_SERIES_CAP } from "./chart-polar-series";
import { sameConfig, useSteady } from "./chart-steady";
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
import { seriesLabel } from "./format/series-label";
import { buildCartesianModel } from "./layout/cartesian-model";
import { ChartDataError, DATA_MESSAGES, dataMessage, isChartDevelopment, issueGroups } from "./layout/errors";
import { sweepOf } from "./layout/polar-angle";

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
    data,
    config,
    nameKey,
    max,
    defaultActiveName,
    selectedKey,
    defaultSelectedKey,
    onSelectedKeyChange,
    description,
    children,
    ...figure
  } = props;
  const { locale } = useLocale();
  const steadyConfig = useSteady<ChartConfig>(config, sameConfig);
  const name = "aria-label" in figure ? figure["aria-label"] : undefined;
  const model = useMemo(() => {
    const issues: PolarIssue[] = [];
    const keys = Object.keys(steadyConfig);
    let drawn = steadyConfig;
    if (keys.length > RADAR_SERIES_CAP) {
      const message = DATA_MESSAGES["radar-series-cap"];
      if (isChartDevelopment()) throw new ChartDataError("RadarChart.Root", "radar-series-cap", message);
      issues.push({ rule: "radar-series-cap", subject: "config", message: `RadarChart.Root ${message}` });
      drawn = Object.fromEntries(Object.entries(steadyConfig).slice(0, RADAR_SERIES_CAP));
    }
    const spokes = buildCartesianModel({
      rows: data,
      series: Object.entries(drawn).map(([key, entry]) => [key, { qualityKey: entry.qualityKey }] as const),
      xKey: nameKey,
      stackOffset: "diverging",
      baseline: "zero",
      include: [],
    });
    const [first] = spokes.issues;
    if (first !== undefined && isChartDevelopment()) {
      throw new ChartDataError("RadarChart.Root", first.rule, dataMessage(first, spokes.rowAt));
    }
    for (const { rule, subject, first: issue, count } of issueGroups(spokes.issues)) {
      issues.push({ rule, subject, message: `RadarChart.Root ${dataMessage(issue, spokes.rowAt, count)}` });
    }
    return radarModel({
      model: spokes,
      config: drawn,
      rows: data,
      locale,
      sweep: sweepOf(0, 360),
      max,
      name,
      issues,
    });
  }, [data, steadyConfig, nameKey, max, locale, name]);
  const defaultActive = defaultActiveName === undefined ? -1 : model.keys.indexOf(String(defaultActiveName));
  return (
    <PolarRoot
      model={model}
      figure={figure}
      defaultActive={defaultActive === -1 ? null : defaultActive}
      selectedKey={selectedKey}
      defaultSelectedKey={defaultSelectedKey}
      onSelectedKeyChange={onSelectedKeyChange}
      labelOf={(key) => seriesLabel({ config: steadyConfig }, key).text}
      description={description}
      locale={locale}>
      {children}
    </PolarRoot>
  );
}

Object.assign(RadarChartRoot, { displayName: "RadarChart.Root" });
