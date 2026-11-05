"use client";

import { useMemo } from "react";
import type { ReactElement, ReactNode } from "react";

import { useLocale } from "../../intl/locale-context";
import { colourFamilyError, nonFiniteThresholds } from "./chart-paint";
import { clockModel } from "./chart-polar-clock";
import type { PolarIssue } from "./chart-polar-context";
import { PolarRoot } from "./chart-polar-root";
import { sameConfig, useSteady } from "./chart-steady";
import type {
  ChartAccessibleName,
  ChartClockCycle,
  ChartClockFieldCheck,
  ChartClockInterval,
  ChartConfig,
  ChartFigureProps,
  ChartInstant,
  ChartKeyOf,
  ChartPeriod,
  ChartRow,
  ChartRowOf,
  ChartSelectionProps,
  ChartSeriesConfigCheck,
  ChartXValue,
  XFormat,
} from "./chart-types";
import { seriesLabel } from "./format/series-label";
import { nextSlotStart, slotStart } from "./format/time-format";
import type { Interval } from "./format/time-format";
import { buildCartesianModel } from "./layout/cartesian-model";
import { intervalNests } from "./layout/coarse-slots";
import {
  ChartCompositionError,
  ChartDataError,
  DATA_MESSAGES,
  dataMessage,
  isChartDevelopment,
  issueGroups,
} from "./layout/errors";
import { sameItems as sameList } from "./layout/same-items";
import { instantOf } from "./layout/x-domain";

/**
 * Props for `ClockChart.Root`, the root of clock charts, one cycle round a calendar dial.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The instant column, inferred from `xKey`.
 * @template TCycle - The dial's cycle, inferred from `cycle`.
 * @beta
 */
export type ClockChartRootProps<
  TRow extends ChartRowOf<TRow> = ChartRow,
  TConfig extends ChartConfig = ChartConfig,
  TXKey extends ChartKeyOf<TRow, ChartInstant> = ChartKeyOf<TRow, ChartInstant>,
  TCycle extends ChartClockCycle = ChartClockCycle,
> = ChartAccessibleName &
  ChartFigureProps &
  ChartSelectionProps<keyof TConfig & string> & {
    /** The rows, one per slot. A row outside the period throws `row-outside-period` in development. */
    data: readonly TRow[];
    /**
     * Keyed by series, as in `Chart.Root`, with its cartesian fields: `stack`, a series `interval`
     * that nests in the cycle, `projectedFrom`, `qualityKey`, `missing` and a threshold `color`.
     * Its `barVariant` is "default" or "gradient".
     */
    config: TConfig & ChartSeriesConfigCheck<TConfig, TRow> & ChartClockFieldCheck<TConfig, TCycle>;
    /** The instant column. Each row starts a slot. */
    xKey: TXKey;
    /**
     * The dial: a day from midnight, an ISO week from Monday 00:00 or a year from 1 January, in
     * Root's zone, whose start sits at 12 o'clock. Every slot takes an equal angle, so a 25-hour day
     * draws 25 equal slots.
     */
    cycle: TCycle;
    /** The slot length, which nests in the cycle. */
    interval: ChartClockInterval<TCycle>;
    /**
     * Exactly one cycle. The cycle that holds `now` is the default, else the first row's. A live
     * feed filters its rows on the cycle, since a row outside it throws in development.
     */
    period?: ChartPeriod;
    /** The current instant: Now's hand, the pending readings after it and `fallback="now"`. */
    now?: ChartInstant;
    /** The IANA zone of the data's market. The LocaleProvider's zone is the default. */
    timeZone?: string;
    /** The slot label format of options, tooltips and the table. */
    xFormat?: XFormat;
    /** How stacks combine. "diverging" by default. */
    stackOffset?: "diverging" | "expand";
    /**
     * "zero" puts 0 in the radius domain, "none" fits the data. "zero" by default. A Column or an
     * Area under "none" throws `baseline-required`, since each draws its value as the length from 0,
     * and a Line draws.
     */
    yBaseline?: "zero" | "none";
    /** Values the radius domain must hold, such as a threshold. */
    yInclude?: readonly number[];
    /** The hole's radius as a share of the dial's, where the domain's minimum sits. 0.3 by default. */
    innerRadius?: number;
    /**
     * How a value's radius grows. "radial" by default keeps area true, so a ring twice the value
     * covers twice the area, and "linear" keeps radius true.
     */
    radiusScale?: "radial" | "linear";
    /** The slot that is active before any pointer or key moves. */
    defaultActiveX?: ChartXValue<TRow[TXKey]>;
    /** "none" turns the entrance off. */
    "data-intro"?: "none";
    /** "past" fades the slots before `now`. */
    "data-fade"?: "past";
    /** Replaces the generated description verbatim. */
    description?: string;
    /** The chart's parts. Root never inspects them. */
    children?: ReactNode;
  };

/** The cycles each interval nests in, and the zone a dial needs. */
function assertDial(
  cycle: ChartClockCycle,
  interval: Interval,
  config: ChartConfig,
  timeZone: string | undefined
): asserts timeZone is string {
  if (timeZone === undefined) {
    throw new ChartCompositionError(
      "ClockChart.Root",
      "time-axis-without-zone",
      'draws a dial with no time zone. Pass timeZone on the Root or on LocaleProvider, the IANA zone of the data\'s market, such as "Europe/Oslo".'
    );
  }
  const nests = (unit: string): boolean =>
    (cycle === "day" && (unit === "quarter-hour" || unit === "hour")) ||
    (cycle === "week" && (unit === "hour" || unit === "day")) ||
    (cycle === "year" && (unit === "hour" || unit === "day" || unit === "month"));
  if (!nests(interval)) {
    throw new ChartCompositionError(
      "ClockChart.Root",
      "interval-not-nested",
      `has interval ${JSON.stringify(interval)}, which does not nest the ${JSON.stringify(cycle)} cycle. A day takes quarter-hours or hours, a week hours or days, and a year hours, days or months.`
    );
  }
  for (const [key, entry] of Object.entries(config)) {
    const own = entry.interval;
    if (own === undefined) continue;
    if (!nests(own) || !intervalNests(interval, own)) {
      throw new ChartCompositionError(
        "ClockChart.Root",
        "interval-not-nested",
        `has config ${JSON.stringify(key)} interval ${JSON.stringify(own)}, which does not nest Root's ${JSON.stringify(interval)} inside the ${JSON.stringify(cycle)} cycle.`
      );
    }
  }
}

/**
 * The root of clock charts, which draw one cycle of a time series round a calendar dial: a day, a
 * week or a year from 12 o'clock, every slot an equal angle.
 *
 * @template TRow - The row type, inferred from `data`.
 * @template TConfig - The config, inferred with its literal keys.
 * @template TXKey - The instant column, inferred from `xKey`.
 * @template TCycle - The dial's cycle, inferred from `cycle`.
 * @beta
 */
export function ClockChartRoot<
  TRow extends ChartRowOf<TRow>,
  const TConfig extends ChartConfig,
  TXKey extends ChartKeyOf<TRow, ChartInstant>,
  const TCycle extends ChartClockCycle,
>(props: ClockChartRootProps<TRow, TConfig, TXKey, TCycle>): ReactElement {
  const {
    data,
    config,
    xKey,
    cycle,
    interval,
    period,
    now,
    timeZone: ownZone,
    xFormat,
    stackOffset = "diverging",
    yBaseline = "zero",
    yInclude,
    innerRadius = 0.3,
    radiusScale = "radial",
    defaultActiveX,
    selectedKey,
    defaultSelectedKey,
    onSelectedKeyChange,
    description,
    children,
    ...figure
  } = props;
  const { locale, timeZone: providerZone } = useLocale();
  const timeZone = ownZone ?? providerZone;
  assertDial(cycle, interval, config, timeZone);
  const steadyConfig = useSteady<ChartConfig>(config, sameConfig);
  const include = useSteady(yInclude, sameList);
  const steadyPeriod = useSteady(period, sameList);
  const colourError = useMemo(
    () => colourFamilyError("ClockChart.Root", steadyConfig, Object.keys(steadyConfig)),
    [steadyConfig]
  );
  if (colourError !== null) throw colourError;
  const name = "aria-label" in figure ? figure["aria-label"] : undefined;
  const nowInstant = now === undefined ? undefined : instantOf(now);
  // The cycle that holds `now`, else the first row's, from its local start to the next cycle's.
  const firstX = data[0]?.[xKey];
  const anchor = nowInstant ?? (firstX === undefined ? undefined : instantOf(firstX));
  const cycleStart =
    anchor === undefined || Number.isNaN(anchor) ? undefined : slotStart(anchor, cycle, timeZone);
  const window: readonly [number, number] | undefined =
    steadyPeriod !== undefined
      ? [instantOf(steadyPeriod[0]), instantOf(steadyPeriod[1])]
      : cycleStart === undefined
        ? undefined
        : [cycleStart, nextSlotStart(cycleStart, cycle, timeZone)];
  const windowStart = window?.[0];
  const windowEnd = window?.[1];
  const model = useMemo(() => {
    const issues: PolarIssue[] = [];
    const series = buildCartesianModel({
      rows: data,
      series: Object.entries(steadyConfig).map(
        ([key, entry]) =>
          [
            key,
            {
              stack: entry.stack,
              qualityKey: entry.qualityKey,
              projectedFrom: entry.projectedFrom,
              interval: entry.interval,
            },
          ] as const
      ),
      xKey,
      time: {
        interval,
        timeZone,
        period: windowStart === undefined || windowEnd === undefined ? undefined : [windowStart, windowEnd],
        now: nowInstant,
      },
      stackOffset,
      baseline: yBaseline,
      include: include ?? [],
    });
    const [first] = series.issues;
    if (first !== undefined && isChartDevelopment()) {
      throw new ChartDataError("ClockChart.Root", first.rule, dataMessage(first, series.rowAt));
    }
    for (const { rule, subject, first: issue, count } of issueGroups(series.issues)) {
      issues.push({ rule, subject, message: `ClockChart.Root ${dataMessage(issue, series.rowAt, count)}` });
    }
    for (const key of nonFiniteThresholds(steadyConfig)) {
      const message = `${DATA_MESSAGES["non-finite-threshold"]} Series ${JSON.stringify(key)}.`;
      if (isChartDevelopment()) throw new ChartDataError("ClockChart.Root", "non-finite-threshold", message);
      issues.push({ rule: "non-finite-threshold", subject: key, message: `ClockChart.Root ${message}` });
    }
    return clockModel({
      model: series,
      config: steadyConfig,
      rows: data,
      locale,
      timeZone,
      cycle,
      inner: Math.min(0.9, Math.max(0, innerRadius)),
      scale: radiusScale,
      now: nowInstant,
      xFormat,
      name,
      issues,
      stackOffset,
      baseline: yBaseline,
    });
  }, [
    data,
    steadyConfig,
    xKey,
    interval,
    timeZone,
    windowStart,
    windowEnd,
    nowInstant,
    stackOffset,
    yBaseline,
    include,
    locale,
    cycle,
    innerRadius,
    radiusScale,
    xFormat,
    name,
  ]);
  const defaultSlot =
    defaultActiveX === undefined || model.drawing.kind !== "clock"
      ? -1
      : // SAFETY: defaultActiveX is a ChartXValue of the instant column, a Date or epoch milliseconds.
        model.drawing.clock.slotOf(defaultActiveX as ChartInstant);
  return (
    <PolarRoot
      model={model}
      figure={figure}
      defaultActive={defaultSlot === -1 ? null : defaultSlot}
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

Object.assign(ClockChartRoot, { displayName: "ClockChart.Root" });
