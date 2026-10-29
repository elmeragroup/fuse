"use client";

import { createContext, memo, use, useId, useLayoutEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { assertKnownKey, useChartLayout, useChartRoot } from "./chart-context";
import type { ChartRootContextValue, CommitKind } from "./chart-context";
import { binsOf, listStops, stepRole, valuePaint } from "./chart-paint";
import { childSlot } from "./chart-reference";
import { useFirstPhase } from "./chart-store";
import type { ChartStore } from "./chart-store";
import type { ChartColor, ChartDatum, ChartLayerProps, ChartX } from "./chart-types";
import { barCells, barForm, columnsPath, introStep, pathColumns } from "./layout/bar-geometry";
import type { PathColumn } from "./layout/bar-geometry";
import type { SeriesModel } from "./layout/cartesian-model";
import type { ColorBins } from "./layout/color-bins";
import { seriesPaint } from "./layout/color-key";
import { keywordSlots, listedSlots } from "./layout/datum";
import { ChartCompositionError, isChartDevelopment } from "./layout/errors";
import { valueTop } from "./layout/plot-geometry";
import { slotTime } from "./layout/readings";
import { slotOf } from "./layout/x-domain";

/**
 * Props for `Chart.Bar`, a closed part.
 *
 * @beta
 */
export type ChartBarProps = ChartLayerProps & {
  /** The series the bars draw. An unknown key throws `unknown-key`. */
  dataKey: string;
  /**
   * The bar's look. "default" by default. "blocks", "isometric" and "expandable" draw in the HTML
   * form only, so above 100 slots they draw the default look and warn `bar-variant-needs-html` in
   * development, and so do "hatched", "striped", "duotone" and "duotone-reverse". The tinted looks,
   * which are "hatched", "striped", "gradient", "duotone" and "duotone-reverse", fill most of a bar
   * with a pale tint of the series colour, so a series relies on the bar's 1 px edge in the full
   * colour and on the legend for its identity. Pair them with a Legend or a Table.
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

/** Whether two key lists hold the same keys in the same order. */
function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

/** The sub-bands a BarGroup splits its band into. */
type BarGroupValue = {
  /** The sub-band of each listed key. Keys that share a stack id share the first one's sub-band. */
  readonly index: ReadonlyMap<string, number>;
  readonly count: number;
};

const ChartBarGroupContext = createContext<BarGroupValue | null>(null);

/** One bar's geometry and state, as plain data so the box can memoise on it. */
type BarDatum = {
  readonly key: string;
  readonly x: number;
  readonly top: number;
  readonly height: number;
  readonly negative: boolean;
  readonly stackTop: boolean;
  readonly quality: string | undefined;
  readonly time: string | undefined;
  readonly paint: string | undefined;
  readonly emphasis: boolean;
  readonly projected: boolean;
  /** The entrance delay step, only while Root has not committed once. */
  readonly step: number | undefined;
};

/** What a bar writes on `data-intro`: nothing in the entrance, `fade` after a data update, else `none`. */
function introOf(phase: "initial" | "mounted", commit: CommitKind): "fade" | "none" | undefined {
  if (phase === "initial") return undefined;
  return commit === "data" ? "fade" : "none";
}

/**
 * One HTML bar. It keys by its slot, so a pan keeps every surviving node, and it keeps the
 * `data-intro` value its first render chose.
 */
const BarBox = memo(function BarBox({
  bar,
  series,
  store,
  commit,
}: {
  readonly bar: BarDatum;
  /** The series ordinal, which every mark writes on `data-series`, per CONTRACT section 11. */
  readonly series: number;
  readonly store: ChartStore;
  readonly commit: CommitKind;
}) {
  const phase = useFirstPhase(store);
  const [intro] = useState(() => introOf(phase, commit));
  return (
    <div
      data-slot="chart-bar"
      data-series={series}
      data-stack-top={bar.stackTop ? "" : undefined}
      data-quality={bar.quality}
      data-time={bar.time}
      data-emphasis={bar.emphasis ? "" : undefined}
      data-projected={bar.projected ? "" : undefined}
      data-intro={intro}
      style={{
        "--chart-bar-x": bar.x,
        "--chart-bar-top": bar.top,
        "--chart-bar-height": bar.height,
        "--chart-bar-neg": bar.negative ? 1 : 0,
        "--chart-bar-paint": bar.paint,
        "--chart-bar-step": bar.step,
      }}
    />
  );
});

/** A short dashed tick at the baseline of a missing reading's cell. */
const MissingTick = memo(function MissingTick({
  x,
  zero,
  series,
}: {
  readonly x: number;
  readonly zero: number;
  readonly series: number;
}) {
  return (
    <div
      data-slot="chart-bar-missing"
      data-series={series}
      style={{ "--chart-bar-x": x, "--chart-bar-top": zero, "--chart-bar-height": 0 }}
    />
  );
});

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

/** Whether a datum's x is a list. */
function isXList(x: ChartX | readonly ChartX[]): x is readonly ChartX[] {
  return Array.isArray(x);
}

/** The slots a Bar's `emphasis` selects. */
function emphasisSlots(
  context: ChartRootContextValue,
  series: SeriesModel | undefined,
  emphasis: ChartDatum | undefined
): number[] {
  const { model } = context;
  if (emphasis === undefined || series === undefined || model.window === null) return [];
  if (
    emphasis !== "first" &&
    emphasis !== "last" &&
    emphasis !== "min" &&
    emphasis !== "max" &&
    emphasis !== "now"
  ) {
    const xs = isXList(emphasis.x) ? emphasis.x : [emphasis.x];
    return listedSlots(
      xs.map((x) => childSlot(context, "Chart.Bar", x)),
      model.window
    );
  }
  const nowSlot =
    context.now === undefined || model.domain.kind !== "time" ? -1 : slotOf(model.domain, context.now);
  return keywordSlots(emphasis, { values: drawnValues(context, series), window: model.window, nowSlot });
}

/** What the path form draws a series with. */
type PathPaint = {
  readonly key: string;
  readonly color: ChartColor;
  readonly bins: ColorBins | undefined;
  /** The path form's own looks. Every other variant draws the default one. */
  readonly variant: "default" | "gradient";
};

/**
 * The path form of one series: one path per colour step, then the projected span, the estimated
 * outlines and the missing ticks. A role list fills through one gradient in user space from the
 * plot top to the zero line, the gradient variant fades through one mask, and `data-fade="past"`
 * dims the past span through one more.
 */
function SeriesPaths({
  context,
  series,
  index,
  columns,
  paint,
  y,
  entering,
}: {
  readonly context: ChartRootContextValue;
  readonly series: SeriesModel;
  /** The series ordinal, which each path writes on `data-series`. */
  readonly index: number;
  readonly columns: readonly PathColumn[];
  readonly paint: PathPaint;
  readonly y: readonly [number, number];
  readonly entering: boolean;
}): ReactElement {
  const id = useId().replaceAll(":", "");
  const { model } = context;
  const window = model.window ?? { first: 0, last: -1 };
  const count = window.last - window.first + 1;
  const zero = valueTop(y, 0);
  const reading = (column: PathColumn) => series.readings[column.slot];
  const isEstimated = (column: PathColumn): boolean => {
    const value = reading(column);
    return value?.kind === "reading" && value.quality === "estimated";
  };
  const isProjected = (column: PathColumn): boolean => column.slot >= series.projectedFrom;
  // Estimated and projected columns draw in their own paths, so the fills leave them out.
  const steps = new Map<string, PathColumn[]>();
  for (const column of columns) {
    if (isEstimated(column) || isProjected(column)) continue;
    const value = reading(column);
    const fill =
      value?.kind === "reading" ? (valuePaint(paint.key, paint.color, paint.bins, value.value) ?? "") : "";
    steps.set(fill, [...(steps.get(fill) ?? []), column]);
  }
  const estimated = columns.filter(isEstimated);
  const projected = columns.filter((column) => isProjected(column) && !isEstimated(column));
  // The model reads no missing marker for an empty chart, as section 8.13 says.
  const missing: string[] = [];
  if (!model.empty) {
    for (let slot = window.first; slot <= window.last; slot += 1) {
      if (series.readings[slot]?.kind !== "missing") continue;
      const position = slot - window.first;
      missing.push(`M${String(position + 0.25)} ${String(zero)}H${String(position + 0.75)}`);
    }
  }
  const stops = listStops(paint.key, paint.color);
  const listFill = stops === undefined ? undefined : `url(#${id}-list)`;
  const fadePast = context.fade === "past" && context.now !== undefined && model.domain.kind === "time";
  const pastEnd = fadePast ? pastSlots(context, window) : 0;
  const masks = [paint.variant === "gradient" ? `url(#${id}-fade)` : undefined].filter(Boolean);
  return (
    <svg
      viewBox={`0 0 ${String(Math.max(count, 1))} 100`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-entering={entering ? "" : undefined}
      style={{ "--chart-zero": zero, "--chart-bar-fill": listFill }}>
      <defs>
        {stops === undefined ? null : (
          <linearGradient id={`${id}-list`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={zero}>
            {stops.map((stop, index) => (
              <stop
                // The roles never reorder, so the position is the stop's identity.
                key={index}
                offset={index / (stops.length - 1)}
                style={{ "--chart-stop": stop }}
              />
            ))}
          </linearGradient>
        )}
        {paint.variant === "gradient" ? (
          <>
            <linearGradient
              id={`${id}-fade-ramp`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="0"
              y2="100">
              <stop offset="0.2" stopColor="currentColor" />
              <stop offset="0.9" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <mask id={`${id}-fade`} maskUnits="userSpaceOnUse" x="0" y="0" width={count} height="100">
              <rect width={count} height="100" fill={`url(#${id}-fade-ramp)`} />
            </mask>
          </>
        ) : null}
        {fadePast ? (
          <mask id={`${id}-past`} maskUnits="userSpaceOnUse" x="0" y="0" width={count} height="100">
            <rect width={pastEnd} height="100" fill="currentColor" fillOpacity="0.4" />
            <rect x={pastEnd} width={Math.max(count - pastEnd, 0)} height="100" fill="currentColor" />
          </mask>
        ) : null}
      </defs>
      <g mask={fadePast ? `url(#${id}-past)` : undefined}>
        <g mask={masks[0]}>
          {[...steps].map(([fill, list]) => (
            <path
              key={fill}
              data-slot="chart-bar-path"
              data-series={index}
              d={columnsPath(list)}
              style={{ "--chart-bar-paint": fill === "" ? undefined : fill }}
            />
          ))}
          {projected.length > 0 ? (
            <path
              data-slot="chart-bar-path"
              data-series={index}
              data-projected=""
              d={columnsPath(projected)}
            />
          ) : null}
        </g>
        {estimated.length > 0 ? (
          <path
            data-slot="chart-bar-path"
            data-series={index}
            data-quality="estimated"
            d={columnsPath(estimated)}
          />
        ) : null}
        {missing.length > 0 ? (
          <path data-slot="chart-bar-path" data-series={index} data-quality="missing" d={missing.join("")} />
        ) : null}
      </g>
    </svg>
  );
}

/** How many of the window's slots ended before Root's `now`, which `data-fade="past"` dims. */
function pastSlots(
  context: ChartRootContextValue,
  window: { readonly first: number; readonly last: number }
): number {
  const { domain } = context.model;
  if (domain.kind !== "time" || context.now === undefined) return 0;
  let past = 0;
  for (let slot = window.first; slot <= window.last; slot += 1) {
    if (slotTime(domain.starts[slot] ?? 0, domain.ends[slot] ?? 0, context.now) === "past") past += 1;
  }
  return past;
}

/**
 * One series' bars. Outside a BarGroup each bar fills its band, and series that share a `stack` id
 * stack in it. Inside a BarGroup the bar takes its series' sub-band. Up to 100 domain slots each
 * bar is an HTML box that moves to its new geometry on a data update. Above 100 the series draws
 * one SVG path per colour step, which snaps to new data until the path tween lands.
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
  const layout = useChartLayout("Chart.Bar");
  const group = use(ChartBarGroupContext);
  assertKnownKey("Chart.Bar", context.config, dataKey);
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
  const window = model.window;
  const form = barForm(model, context.orientation);
  const grouped = group !== null;
  useLayoutEffect(() => registerBar(dataKey, grouped), [registerBar, dataKey, grouped]);
  const picked = emphasisSlots(context, series, emphasis);
  const pickedKey = picked.join(",");
  const emphasised = useMemo(() => new Set(picked), [pickedKey]); // oxlint-disable-line react-hooks/exhaustive-deps -- the joined slots are the identity
  useLayoutEffect(
    () => registerEmphasis(dataKey, { slots: [...emphasised], label: emphasisLabel }),
    [registerEmphasis, dataKey, emphasised, emphasisLabel]
  );
  // The path form has two looks of its own. Every other variant draws the default look there.
  const pathVariant = variant === "gradient" ? "gradient" : "default";
  const htmlOnly = variant !== "default" && variant !== "gradient";
  if (form === "path" && htmlOnly && isChartDevelopment()) {
    console.warn(
      `Chart.Bar draws ${JSON.stringify(dataKey)} as one path above 100 slots, where variant="${variant}" has no path look, so it draws the default variant. Narrow the period to 100 slots or fewer, or pick another variant.`
    );
  }
  const color = config?.color ?? "chart-1";
  const bins = binsOf(config?.color, series);
  const seriesIndex = series?.seriesIndex ?? 0;
  const n = String(seriesIndex);
  const count = window === null ? 1 : window.last - window.first + 1;
  const width = 100 / count;
  // The server and a hydrating Root hold no entrance, so the steps exist only in a browser mount's
  // first render, and the next data update renders them away before it moves the bars.
  const entering = context.entrance && context.store.get().phase === "initial";
  const bars: BarDatum[] = [];
  const missing: { readonly key: string; readonly x: number }[] = [];
  let columns: PathColumn[] = [];
  if (series && window && form === "html") {
    const { domain } = model;
    for (const cell of barCells(model, series, layout.y.domain)) {
      const reading = series.readings[cell.slot];
      const value = reading?.kind === "reading" ? reading : undefined;
      bars.push({
        key: context.slotKeys[cell.slot] ?? String(cell.slot),
        x: cell.position * width,
        top: cell.top,
        height: cell.height,
        negative: cell.negative,
        stackTop: cell.stackTop,
        quality: value === undefined || value.quality === "measured" ? undefined : value.quality,
        time:
          domain.kind === "time" && context.now !== undefined
            ? slotTime(domain.starts[cell.slot] ?? 0, domain.ends[cell.slot] ?? 0, context.now)
            : undefined,
        paint: value === undefined ? undefined : valuePaint(dataKey, color, bins, value.value),
        emphasis: emphasised.has(cell.slot),
        projected: cell.slot >= series.projectedFrom,
        step:
          entering && context.intro !== "none"
            ? introStep(context.intro ?? "left", cell.position, count)
            : undefined,
      });
    }
    // An empty chart draws no missing marker, as section 8.13 says.
    for (let slot = window.first; slot <= window.last && !model.empty; slot += 1) {
      if (series.readings[slot]?.kind !== "missing") continue;
      missing.push({ key: context.slotKeys[slot] ?? String(slot), x: (slot - window.first) * width });
    }
  } else if (series && window) {
    columns = pathColumns(model, series, layout.y.domain, {
      index: group?.index.get(dataKey) ?? 0,
      count: group?.count ?? 1,
    });
  }
  const stops = listStops(dataKey, color);
  const zero = valueTop(layout.y.domain, 0);
  return (
    <div
      data-slot="chart-bar-series"
      data-variant={form === "path" ? pathVariant : variant}
      data-list={stops === undefined ? undefined : ""}
      data-series={seriesIndex}
      data-emphasis={emphasised.size > 0 ? "" : undefined}
      aria-hidden="true"
      className={className}
      style={{
        "--chart-series-paint": seriesPaint(dataKey, stepRole(color, undefined)),
        "--chart-series-stops": stops?.join(", "),
        "--chart-series": seriesIndex,
        "--chart-bar-w": width,
        "--chart-sub-index": group?.index.get(dataKey) ?? 0,
        "--chart-sub-count": group?.count ?? 1,
        ...style,
      }}>
      {form === "html" ? (
        bars.map((bar) => (
          <BarBox
            key={bar.key}
            bar={bar}
            series={seriesIndex}
            store={context.store}
            commit={context.commit}
          />
        ))
      ) : series ? (
        <SeriesPaths
          context={context}
          series={series}
          index={seriesIndex}
          columns={columns}
          paint={{ key: dataKey, color, bins, variant: pathVariant }}
          y={layout.y.domain}
          entering={entering}
        />
      ) : null}
      {form === "path" && series && window
        ? [...emphasised].map((slot) => {
            const extent = series.extents[slot];
            if (!extent) return null;
            const top = valueTop(layout.y.domain, extent[1]);
            return (
              <div
                key={slot}
                data-slot="chart-bar-emphasis"
                data-series={seriesIndex}
                style={{
                  "--chart-bar-x": (slot - window.first) * width,
                  "--chart-bar-top": top,
                  "--chart-bar-height": valueTop(layout.y.domain, extent[0]) - top,
                }}
              />
            );
          })
        : null}
      {missing.map((tick) => (
        <MissingTick key={tick.key} x={tick.x} zero={zero} series={seriesIndex} />
      ))}
      <div
        data-slot="chart-bar-active"
        data-series={seriesIndex}
        data-follow=""
        style={{
          "--chart-bar-top": `var(--chart-y-${n}, 0)`,
          "--chart-bar-height": `var(--chart-h-${n}, 0)`,
          "--chart-bar-neg": `var(--chart-n-${n}, 0)`,
          "--chart-bar-round": `var(--chart-r-${n}, 1)`,
          "--chart-has-value": `var(--chart-v-${n}, 0)`,
          "--chart-bar-paint": `var(--chart-p-${n})`,
        }}
      />
    </div>
  );
}

/**
 * Bars side by side in one band, one sub-band per entry of `series`, with `--chart-bar-gap`
 * between them. Series that share a `stack` id share one sub-band, at the place of the first of
 * them. Each Bar inside names a listed key, or it throws `bar-not-in-group`.
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
  for (const key of series) assertKnownKey("Chart.BarGroup", context.config, key);
  const { stacks } = context.model;
  // The keys compare as a tuple, so an inline array that lists the same keys is no change.
  const [steadySeries, setSteadySeries] = useState(series);
  let groupSeries = steadySeries;
  if (steadySeries !== series && !sameKeys(steadySeries, series)) {
    groupSeries = series;
    setSteadySeries(series);
  }
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
    return { index, count };
  }, [groupSeries, stacks]);
  return (
    <div data-slot="chart-bar-group" aria-hidden="true" className={className} style={style}>
      <ChartBarGroupContext value={value}>{children}</ChartBarGroupContext>
    </div>
  );
}

Object.assign(ChartBar, { displayName: "Chart.Bar" });
Object.assign(ChartBarGroup, { displayName: "Chart.BarGroup" });
