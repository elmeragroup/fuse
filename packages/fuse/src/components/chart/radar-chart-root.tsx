"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
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
import {
  ChartDataError,
  DATA_MESSAGES,
  dataMessage,
  isChartDevelopment,
  issueRecords,
} from "./layout/errors";
import type { IssueRecord } from "./layout/errors";
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
    /**
     * The rows, one per spoke. The first row's spoke points to 12 o'clock and the rest follow
     * clockwise, so a cyclic profile such as the days of a week puts its last spoke beside its
     * first. Negative values draw inside a zero ring. With no reading the chart shows `Empty` and
     * has no tab stop. A server component can render the chart when every prop is plain data.
     */
    data: readonly TRow[];
    /**
     * Keyed by series, as in `Chart.Root`. Each entry is a `ChartSeriesConfig` with `label`,
     * `color` and optionally `format`, `icon`, `missing` and `qualityKey`. A radar compares at most 4
     * series. A fifth literal key fails the type, and a fifth runtime key throws in development and
     * draws the first four in production. It takes no `stack`, `projectedFrom`, `interval` or scale.
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
     * wins, so no reading is clamped. The center is 0, or the niced minimum when a value is negative,
     * and then the grid draws a zero ring.
     */
    max?: number;
    /**
     * The spoke that is active before any pointer or key moves. Root reads the name once, at mount.
     * If no row names the spoke yet, it turns active when a row first does, unless a reader has
     * already moved the active spoke. While the spoke is active by default, `RadarChart.Tooltip`
     * opens only while enough of the plot shows. The plot's room is the overlap of the viewport and
     * the padding box of each ancestor that clips its overflow. Fuse caps the room's width and
     * height at the plot's, and the plot must show at least half of each. The rule ends when a
     * reader takes over: a pointer pick, keyboard focus on the plot, even with the same spoke still
     * active, or a pin.
     */
    defaultActiveName?: TRow[TNameKey];
    /**
     * "none" turns off the entrance, in which each series grows from the center the first time the
     * chart comes into view.
     */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /**
     * The chart's parts. Root never inspects them. The plot is one tab stop. Hover a spoke, or focus
     * the chart and use the arrow keys, to read it. ArrowLeft and ArrowRight move between spokes,
     * and ArrowUp and ArrowDown between series. The series other than the nearest dim. On a touch
     * screen a drag that starts on the dial scrubs round it, a tap pins the tooltip, and a second
     * tap on the same spoke releases it.
     */
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
    const issues: IssueRecord[] = [];
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
    const records = issueRecords("RadarChart.Root", spokes.issues, (issue, count) =>
      dataMessage(issue, spokes.rowAt, count)
    );
    // A loop appends, since a spread of many records overflows the stack.
    for (const record of records) issues.push(record);
    return radarModel({
      model: spokes,
      config: drawn,
      known: steadyConfig,
      rows: data,
      locale,
      sweep: sweepOf(0, 360),
      max,
      name,
      issues,
    });
  }, [data, steadyConfig, nameKey, max, locale, name]);
  return (
    <PolarRoot
      model={model}
      figure={figure}
      resolveDefault={(current) =>
        defaultActiveName === undefined ? -1 : current.keys.indexOf(String(defaultActiveName))
      }
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
