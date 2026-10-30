"use client";

import { createContext, use, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import type { SeriesPaint } from "./chart-bar-draw";
import { SeriesPaths } from "./chart-bar-paths";
import { ActiveBar, SeriesBars } from "./chart-bar-series";
import { assertKnownKey, assertLayoutKey, usePlotLayout, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { datumSlots } from "./chart-datum";
import { binsOf, listStops, stepRole } from "./chart-paint";
import { useBarMetrics, useChartFrame } from "./chart-plot";
import type { ChartPlot } from "./chart-plot";
import { useFirstPhase } from "./chart-store";
import type { ChartDatum, ChartLayerProps } from "./chart-types";
import { barForm } from "./layout/bar-geometry";
import type { BarVariant } from "./layout/bar-shapes";
import type { SeriesModel } from "./layout/cartesian-model";
import { seriesPaint } from "./layout/color-key";
import { ChartCompositionError, isChartDevelopment } from "./layout/errors";
import { WHOLE_BAND } from "./layout/plot-frame";
import type { BarMetrics, SubBand } from "./layout/plot-frame";

/**
 * Props for `Chart.Bar`, a closed part.
 *
 * @beta
 */
export type ChartBarProps = ChartLayerProps & {
  /** The series the bars draw. An unknown key throws `unknown-key`. */
  dataKey: string;
  /**
   * The bar's look. "default" by default. Above 100 slots a series draws as one path, which knows
   * the "default" and "gradient" looks only, so every other look draws the default one there and
   * warns `bar-variant-needs-html` in development. The tinted looks, which are "hatched",
   * "striped", "gradient", "duotone" and "duotone-reverse", fill most of a bar with a pale tint of
   * the series colour, so a series relies on the bar's 1 px edge in the full colour and on the
   * legend for its identity. Pair them with a Legend or a Table.
   */
  variant?:
    | "default"
    | "hatched"
    | "duotone"
    | "duotone-reverse"
    | "gradient"
    | "striped"
    | "blocks"
    | "expandable"
    | "isometric";
  /**
   * The slots to emphasise. `"now"` selects the slot of this series that contains Root's `now`, so
   * an hourly bar on a quarter-hour chart emphasises its whole hour. `"max"` and `"min"` compare the
   * drawn value, the stack total for a stacked bar, and select every tied slot. An x string on a
   * time axis throws `x-type-mismatch`.
   */
  emphasis?: ChartDatum;
  /** The word the option appends to an emphasised slot. The dictionary's "uthevet" is the default. */
  emphasisLabel?: string;
};

/**
 * Props for `Chart.BarGroup`, a closed part.
 *
 * @beta
 */
export type ChartBarGroupProps = ChartLayerProps & {
  /** The config keys that share the band, one sub-band each, in this order. */
  series: readonly string[];
  /** The group's Bar parts. */
  children?: ReactNode;
};

/** What the Bar's first drawing render drew under, which its entrance belongs to. */
type FirstDraw = {
  readonly plot: ChartPlot;
  readonly form: "bars" | "path";
  readonly orientation: "vertical" | "horizontal";
};

/** Whether two key lists hold the same keys in the same order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/** The sub-bands a BarGroup splits its band into, and the spacing its bars share. */
type BarGroupValue = {
  /** The sub-band of each listed key. Keys that share a stack id share the first one's sub-band. */
  readonly index: ReadonlyMap<string, number>;
  readonly count: number;
  /** The spacing on the group's own element, or null before its first read. */
  readonly metrics: BarMetrics | null;
};

const ChartBarGroupContext = createContext<BarGroupValue | null>(null);

/** The value a Bar draws at each slot, the stack total for a stacked key. */
function drawnValues(context: ChartRootContextValue, series: SeriesModel): (number | null)[] {
  const keys = context.model.stacks.find(({ id }) => id === series.stack)?.keys ?? [series.key];
  const members = context.model.series.filter(({ key }) => keys.includes(key));
  return series.readings.map((reading, slot) => {
    if (reading.kind !== "reading") return null;
    let total = 0;
    for (const member of members) {
      const other = member.readings[slot];
      if (other?.kind === "reading") total += other.value;
    }
    return total;
  });
}

/** The slots a Bar's `emphasis` selects, compared on the values it draws. */
function emphasisSlots(
  context: ChartRootContextValue,
  series: SeriesModel | undefined,
  emphasis: ChartDatum | undefined
): number[] {
  if (emphasis === undefined || series === undefined) return [];
  return datumSlots(context, "Chart.Bar", series, emphasis, drawnValues(context, series));
}

/**
 * One series' bars. Outside a BarGroup each bar fills its band, and series that share a `stack` id
 * stack in it. Inside a BarGroup the bar takes its series' sub-band. Up to 100 domain slots each
 * bar is its own SVG element that moves to its new geometry on a data update. Above 100 the series
 * draws one SVG path per colour step, which snaps to new data until the path tween lands.
 *
 * @beta
 */
export function ChartBar({
  dataKey,
  variant = "default",
  emphasis,
  emphasisLabel,
  className,
  style,
}: ChartBarProps): ReactElement {
  const context = useChartRoot("Chart.Bar");
  const layout = usePlotLayout("Chart.Bar");
  const group = use(ChartBarGroupContext);
  assertKnownKey("Chart.Bar", context.config, dataKey);
  assertLayoutKey("Chart.Bar", layout, dataKey);
  if (layout.baseline === "none") {
    throw new ChartCompositionError(
      "Chart.Bar",
      "baseline-required",
      'draws in a layout with yBaseline="none", but a bar encodes length from 0. Keep the zero baseline, or draw a Chart.Line.'
    );
  }
  if (context.xScale === "point") {
    throw new ChartCompositionError(
      "Chart.Bar",
      "bar-needs-band",
      'draws under xScale="point", where slots have no width. Use the default xScale="band".'
    );
  }
  if (group !== null && !group.index.has(dataKey)) {
    throw new ChartCompositionError(
      "Chart.Bar",
      "bar-not-in-group",
      `draws ${JSON.stringify(dataKey)} inside a Chart.BarGroup whose series do not list it. Add the key to the group's series, or move the Bar out of the group.`
    );
  }
  const { model, registerBar, registerEmphasis } = context;
  const series = model.series.find(({ key }) => key === dataKey);
  const config = context.config[dataKey];
  const form = barForm(model, context.orientation);
  const grouped = group !== null;
  const phase = useFirstPhase(context.store);
  const [firstUpdate] = useState(context.update);
  const drawn = useChartFrame("Chart.Bar", layout);
  // SVG references read the id inside url(), so it keeps only characters an IRI fragment takes as is.
  const prefix = `chart-bar-${useId().replace(/[^\w-]/gu, "")}`;
  useLayoutEffect(
    () => registerBar(dataKey, grouped, layout.owner),
    [registerBar, dataKey, grouped, layout.owner]
  );
  const picked = emphasisSlots(context, series, emphasis);
  const pickedKey = picked.join(",");
  const emphasised = useMemo(() => new Set(picked), [pickedKey]); // oxlint-disable-line react-hooks/exhaustive-deps -- the joined slots are the identity
  useLayoutEffect(
    () => registerEmphasis(dataKey, { slots: [...emphasised], label: emphasisLabel }),
    [registerEmphasis, dataKey, emphasised, emphasisLabel]
  );
  // The look the series draws, which its marks, its attributes and its overlay all read. The path
  // form has two looks of its own, and every other variant draws the default look there.
  const drawnVariant: BarVariant =
    form === "bars" ? variant : variant === "gradient" ? "gradient" : "default";
  if (drawnVariant !== variant && isChartDevelopment()) {
    console.warn(
      `Chart.Bar draws ${JSON.stringify(dataKey)} as one path above 100 slots, where variant="${variant}" has no path look, so it draws the default variant. Narrow the period to 100 slots or fewer, or pick another variant.`
    );
  }
  const color = config?.color ?? "chart-1";
  // The paint follows the series' readings and its colour, which the model and config carry.
  const paint = useMemo(
    (): SeriesPaint => ({
      key: dataKey,
      color,
      bins: binsOf(color, series),
      base: seriesPaint(dataKey, stepRole(color, undefined)),
      stops: listStops(dataKey, color),
    }),
    [dataKey, color, series]
  );
  const { base, stops } = paint;
  const subIndex = group?.index.get(dataKey) ?? 0;
  const subCount = group?.count ?? 1;
  const sub = useMemo(
    (): SubBand => (grouped ? { index: subIndex, count: subCount } : WHOLE_BAND),
    [grouped, subIndex, subCount]
  );
  const seriesIndex = series?.seriesIndex ?? 0;
  const svg = useRef<SVGSVGElement>(null);
  // A BarGroup owns the spacing of its bars, so they split each band alike. Outside a group the
  // Bar's own element holds it. Either way the marks wait for the first read.
  const own = useBarMetrics(grouped ? null : svg);
  const metrics = group === null ? own : group.metrics;
  const ready =
    drawn === null || metrics === null || series === undefined ? null : { drawn, metrics, series };
  const shared =
    ready === null
      ? null
      : {
          context,
          series: ready.series,
          frame: ready.drawn.frame,
          plot: ready.drawn.plot,
          metrics: ready.metrics,
          sub,
          paint,
          prefix,
          phase,
        };
  // The entrance is one event in the Bar's life: it runs in the first render that draws the series,
  // in a browser mount, under the update the Bar first rendered. The Bar records what that render
  // drew under, and the first render that draws under any other measurement, form or orientation
  // spends the entrance for good, so a form swap, an orientation change or a remount of either
  // form draws at once, even back under the first one. Both forms read this one decision.
  const [firstDraw, setFirstDraw] = useState<FirstDraw | null>(null);
  const [spent, setSpent] = useState(false);
  const here: FirstDraw | null =
    shared === null || drawn === null ? null : { plot: drawn.plot, form, orientation: context.orientation };
  if (here !== null && firstDraw === null) setFirstDraw(here);
  const sameDraw =
    firstDraw === null ||
    here === null ||
    (firstDraw.plot === here.plot &&
      firstDraw.form === here.form &&
      firstDraw.orientation === here.orientation);
  if (!sameDraw && !spent) setSpent(true);
  const entering =
    !spent && sameDraw && context.entrance && phase === "initial" && context.update === firstUpdate;
  return (
    <svg
      ref={svg}
      data-slot="chart-bar-series"
      data-variant={drawnVariant}
      data-list={stops === undefined ? undefined : ""}
      data-series={seriesIndex}
      data-emphasis={emphasised.size > 0 ? "" : undefined}
      aria-hidden="true"
      className={className}
      style={{
        "--chart-series-paint": base,
        "--chart-series": seriesIndex,
        ...style,
      }}>
      {shared === null ? null : form === "bars" ? (
        <SeriesBars
          {...shared}
          entering={entering}
          variant={drawnVariant}
          emphasised={emphasised}
          firstUpdate={firstUpdate}
        />
      ) : (
        <SeriesPaths {...shared} entering={entering} variant={drawnVariant} emphasised={emphasised} />
      )}
      {shared === null ? null : <ActiveBar {...shared} variant={drawnVariant} form={form} />}
    </svg>
  );
}

/**
 * Bars side by side in one band, one sub-band per entry of `series`, with `--chart-bar-gap`
 * between them. The group's own spacing holds for every Bar in it, so its `style` may set
 * `--chart-band-gap`, `--chart-bar-gap` and `--chart-bar-seam` for all of them at once. Series that
 * share a `stack` id share one sub-band, at the place of the first of them.
 * Each Bar inside names a listed key, or it throws `bar-not-in-group`.
 *
 * @beta
 */
export function ChartBarGroup({ series, className, style, children }: ChartBarGroupProps): ReactElement {
  const context = useChartRoot("Chart.BarGroup");
  if (use(ChartBarGroupContext) !== null) {
    throw new ChartCompositionError(
      "Chart.BarGroup",
      "nested-bar-group",
      "sits inside another Chart.BarGroup. List every key in one group's series."
    );
  }
  const layout = usePlotLayout("Chart.BarGroup");
  for (const key of series) {
    assertKnownKey("Chart.BarGroup", context.config, key);
    assertLayoutKey("Chart.BarGroup", layout, key);
  }
  const { stacks } = context.model;
  // The keys compare as a tuple, so an inline array that lists the same keys is no change.
  const [steadySeries, setSteadySeries] = useState(series);
  let groupSeries = steadySeries;
  if (steadySeries !== series && !sameKeys(steadySeries, series)) {
    groupSeries = series;
    setSteadySeries(series);
  }
  const element = useRef<HTMLDivElement>(null);
  const metrics = useBarMetrics(element);
  const value = useMemo((): BarGroupValue => {
    const index = new Map<string, number>();
    const stackPlace = new Map<string, number>();
    let count = 0;
    for (const key of groupSeries) {
      const stack = stacks.find(({ keys }) => keys.includes(key))?.id;
      const shared = stack === undefined ? undefined : stackPlace.get(stack);
      if (shared !== undefined) {
        index.set(key, shared);
        continue;
      }
      index.set(key, count);
      if (stack !== undefined) stackPlace.set(stack, count);
      count += 1;
    }
    return { index, count, metrics };
  }, [groupSeries, stacks, metrics]);
  return (
    <div ref={element} data-slot="chart-bar-group" aria-hidden="true" className={className} style={style}>
      <ChartBarGroupContext value={value}>{children}</ChartBarGroupContext>
    </div>
  );
}

Object.assign(ChartBar, { displayName: "Chart.Bar" });
Object.assign(ChartBarGroup, { displayName: "Chart.BarGroup" });
