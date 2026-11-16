"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { pieModel } from "./chart-polar-item";
import { PolarRoot } from "./chart-polar-root";
import { sameConfig, sameShallow, useSteady } from "./chart-steady";
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
import { seriesLabel } from "./format/series-label";
import { OTHER_KEY } from "./layout/pie";
import { parseSweep } from "./layout/polar-angle";

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
    /**
     * The rows, one per slice, drawn in data order from `startAngle`, clockwise. Sort the rows to put
     * the largest slice first. A negative value throws `negative-polar-value`. A data update tweens
     * the slices to their new angles, and a slice that leaves collapses into its neighbour's seam.
     * Every value above 0 keeps at least one device pixel of rim, and the labels, the tooltip and
     * the table keep the true value. With no value above 0 the chart shows `Empty` and has no tab
     * stop. A server component can render the chart when every prop is plain data, and with
     * JavaScript off or in print the whole chart shows at once.
     */
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
    /**
     * The column that holds each slice's `ChartQuality`. An estimated slice draws hatched, a missing
     * one draws no arc, and the table names each slice's quality.
     */
    qualityKey?: ChartQualityKey<TRow>;
    /** The value format. A category's config `format` overrides it. */
    valueFormat?: ValueFormat;
    /** A fraction of the outer radius. 0, the default, draws a pie, and the Figma donut uses 0.62. */
    innerRadius?: number;
    /** Degrees between slices. A negative value overlaps neighbours. */
    padAngle?: number;
    /**
     * Degrees from 12 o'clock, clockwise, where the first slice starts. 0 by default. An angle that
     * is not a finite number, here or in `endAngle`, throws `invalid-sweep`.
     */
    startAngle?: number;
    /**
     * Degrees from 12 o'clock, clockwise, where the last slice ends. 360 by default. The chart keeps
     * the aspect of the sweep's bounding box, so a semicircle from -90 to 90 is twice as wide as it
     * is tall.
     */
    endAngle?: number;
    /**
     * Turns the sweep into a gauge, where the slices fill their total's share of `max` and `Track`
     * draws the rest. A total above `max` fills the whole sweep and sets `data-over-max`, and the
     * texts keep the true value.
     */
    max?: number;
    /**
     * The most slices drawn, 6 by default. Past it the smallest rows fold into one Other slice, which
     * comes last and prints `otherLabel` with the number of categories it holds. The table lists
     * every row unfolded.
     */
    maxSlices?: number;
    /** The Other slice's label. The dictionary's "Annet" is the default. */
    otherLabel?: string;
    /** The slice that is active before any pointer or key moves. A folded category activates Other. */
    defaultActiveKey?: keyof TConfig & string;
    /** "none" turns off the entrance, which sweeps the slices in the first time the chart comes into view. */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /**
     * The chart's parts. Root never inspects them. The plot is one tab stop. Hover a slice, or focus
     * the chart and use the arrow keys, to make it active. The active slice moves out along its
     * bisector by `--chart-slice-pop`, 8 px by default, and the others dim. A pointer anywhere in the
     * chart's cell picks the slice under its angle, the hole and the space past the rim included. On
     * a touch screen a drag that starts on the dial scrubs round it, a tap pins the tooltip, and a
     * second tap on the same slice releases it.
     */
    children?: ReactNode;
  };

/**
 * The root of pie and donut charts. Slices draw in data order from 12 o'clock, clockwise, and past
 * `maxSlices` the smallest rows fold into one Other slice. The entrance sweeps slice i in from
 * 100 ms + i · `--chart-stagger` over `--chart-intro`, both read from the figure's style.
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
    data,
    config,
    nameKey,
    valueKey,
    qualityKey,
    valueFormat,
    innerRadius = 0,
    padAngle = 0,
    startAngle = 0,
    endAngle = 360,
    max,
    maxSlices = 6,
    otherLabel,
    defaultActiveKey,
    selectedKey,
    defaultSelectedKey,
    onSelectedKeyChange,
    description,
    children,
    ...figure
  } = props;
  const { locale } = useLocale();
  const steadyConfig = useSteady<ChartConfig>(config, sameConfig);
  // An inline valueFormat object that names the same options is no change either.
  const steadyFormat = useSteady(valueFormat, sameShallow);
  const name = "aria-label" in figure ? figure["aria-label"] : undefined;
  const model = useMemo(
    () =>
      pieModel({
        rows: data,
        config: steadyConfig,
        nameKey,
        valueKey,
        qualityKey,
        valueFormat: steadyFormat,
        sweep: parseSweep("PieChart.Root", startAngle, endAngle),
        locale,
        name,
        part: "PieChart.Root",
        maxSlices,
        innerRadius,
        padAngle,
        max,
        otherLabel,
      }),
    [
      data,
      steadyConfig,
      nameKey,
      valueKey,
      qualityKey,
      steadyFormat,
      startAngle,
      endAngle,
      locale,
      name,
      maxSlices,
      innerRadius,
      padAngle,
      max,
      otherLabel,
    ]
  );
  // A default that names a folded category activates Other, the item that stands for its row. One
  // with no row stands for nothing, so nothing starts active.
  const own = defaultActiveKey === undefined ? -1 : model.keys.indexOf(defaultActiveKey);
  const folds =
    own === -1 &&
    defaultActiveKey !== undefined &&
    model.drawing.kind === "pie" &&
    model.drawing.pie.folds(defaultActiveKey);
  const folded = folds ? model.keys.indexOf(OTHER_KEY) : -1;
  const defaultActive = own !== -1 ? own : folded;
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

Object.assign(PieChartRoot, { displayName: "PieChart.Root" });
