"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { radialModel } from "./chart-polar-item";
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
import { parseSweep } from "./layout/polar-angle";
import type { RingMaxima } from "./layout/rings";
import { numberOf } from "./layout/scalar";

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
    /**
     * The rows, one per ring, the first outermost. Sort rings in one unit largest first, so the
     * longest arc holds the largest value. A negative value throws `negative-polar-value`. Each ring
     * fills its value's share of its maximum and never laps. A value past its maximum fills the whole
     * sweep and sets `data-over-max` on its ring, and the center, the tooltip and the table keep the
     * true share. A data update morphs each ring to its new value, and every value above 0 keeps at
     * least one device pixel of arc. With no reading the chart shows `Empty` and has no tab stop.
     */
    data: readonly TRow[];
    /**
     * One entry per category, keyed by category value. Each entry is a `ChartSeriesConfig` with
     * `label`, `color` and optionally `format` and `icon`. It takes no `stack`, `projectedFrom`,
     * `qualityKey`, `interval` or `missing`, and its colors are `ChartPolarColor` roles. Root's
     * `qualityKey` names the quality column instead.
     */
    config: TConfig & ChartCategoryConfigCheck<TConfig, TRow[TNameKey]>;
    /** The column that names each ring. */
    nameKey: TNameKey;
    /** The column that fills each ring. */
    valueKey: TValueKey;
    /** The column that holds each ring's `ChartQuality`. An estimated ring draws hatched. */
    qualityKey?: ChartQualityKey<TRow>;
    /** The value format. A category's config `format` overrides it. */
    valueFormat?: ValueFormat;
    /** The fraction of the outer radius where the innermost ring starts. */
    innerRadius?: number;
    /**
     * Degrees from 12 o'clock, clockwise, where each ring's sweep starts. An angle that is not a
     * finite number, here or in `endAngle`, throws `invalid-sweep`.
     */
    startAngle?: number;
    /**
     * Degrees from 12 o'clock, clockwise, where a full ring's sweep ends. A shorter sweep draws a
     * gauge, and the chart keeps the aspect of the sweep's bounding box.
     */
    endAngle?: number;
    /**
     * The ring that is active before any pointer or key moves. Root reads the key once, at mount.
     * If the data has no ring for the key yet, the ring turns active when the data first has one,
     * unless a reader has already moved the active ring. While the ring is active by default,
     * `RadialChart.Tooltip` opens only while enough of the plot shows. The plot's room is the
     * overlap of the viewport and the padding box of each ancestor that clips its overflow. Fuse
     * caps the room's width and height at the plot's, and the plot must show at least half of each.
     * The rule ends when a reader takes over: a pointer pick, keyboard focus on the plot, even with
     * the same ring still active, or a pin.
     */
    defaultActiveKey?: keyof TConfig & string;
    /**
     * "none" turns off the entrance, in which the tracks scale out and the rings sweep in the first
     * time the chart comes into view.
     */
    "data-intro"?: "none";
    /** Replaces the generated description verbatim. */
    description?: string;
    /**
     * The chart's parts. Root never inspects them. The plot is one tab stop. Hover a ring, or focus
     * the chart and use the arrow keys, to make it active. The active ring and the rings outside it
     * grow a little, and the others dim. On a touch screen a drag that starts on the dial scrubs
     * round it, a tap pins the tooltip, and a second tap on the same ring releases it.
     */
    children?: ReactNode;
  } & (
    | {
        /**
         * One maximum for every ring. Without it or `maxKey`, the largest value fills its ring. Pass
         * `max` or `maxKey`, not both.
         */
        max?: number;
        /**
         * The column that holds each row's own maximum, such as a budget per ring. Pass `max` or
         * `maxKey`, not both.
         */
        maxKey?: never;
      }
    | {
        /**
         * The column that holds each row's own maximum, such as a budget per ring. Pass `max` or
         * `maxKey`, not both.
         */
        maxKey: ChartSeriesKey<TRow>;
        /**
         * One maximum for every ring. Without it or `maxKey`, the largest value fills its ring. Pass
         * `max` or `maxKey`, not both.
         */
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
    data,
    config,
    nameKey,
    valueKey,
    qualityKey,
    valueFormat,
    innerRadius = 0.3,
    startAngle = 0,
    endAngle = 360,
    max,
    maxKey,
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
  const model = useMemo(() => {
    const maxima: RingMaxima =
      maxKey !== undefined
        ? { kind: "rows", maxima: data.map((row) => numberOf(row[maxKey]) ?? null) }
        : max !== undefined
          ? { kind: "root", max }
          : { kind: "largest" };
    return radialModel({
      rows: data,
      config: steadyConfig,
      nameKey,
      valueKey,
      qualityKey,
      valueFormat: steadyFormat,
      sweep: parseSweep("RadialChart.Root", startAngle, endAngle),
      locale,
      name,
      part: "RadialChart.Root",
      maxima,
      innerRadius,
    });
  }, [
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
    max,
    maxKey,
    innerRadius,
  ]);
  return (
    <PolarRoot
      model={model}
      figure={figure}
      resolveDefault={(current) =>
        defaultActiveKey === undefined ? -1 : current.keys.indexOf(defaultActiveKey)
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

Object.assign(RadialChartRoot, { displayName: "RadialChart.Root" });
