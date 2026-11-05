"use client";

/**
 * The series adapter, which Radar reads its Root through, and ClockChart from L7. It builds a
 * `CartesianModel` over the family's own domain, a category per spoke here, and reuses the
 * cartesian series readout as it is: an index is a spoke, the legend lists the config keys, the
 * tooltip lists every series at the active spoke, and the option names every series or the focused
 * one, in the cartesian grammar. It reads no plot geometry.
 */
import type { SupportedLocale } from "../../intl/locale-context";
import { readingPaint, seriesPaintOf } from "./chart-paint";
import type { PolarIssue, PolarKernel, PolarModel } from "./chart-polar-context";
import type { ChartReadout, ReadoutItem } from "./chart-readout-port";
import {
  fallbackSlot,
  readingAt,
  readingText,
  seriesTable,
  slotShares,
  windowShares,
} from "./chart-series-readout";
import { optionName, slotLabel } from "./chart-text";
import type { TextContext } from "./chart-text";
import type { ChartColor, ChartConfig, ChartQuality, ChartRow, ChartThresholdSide } from "./chart-types";
import { CHART_STRINGS, countOf } from "./format/chart-strings";
import { POLAR_STRINGS } from "./format/polar-strings";
import { seriesLabel } from "./format/series-label";
import { formatValue } from "./format/value-format";
import type { CartesianModel } from "./layout/cartesian-model";
import { isRoleList, isThresholdColor, seriesPaint, singleRole } from "./layout/color-key";
import { assertKnownKey } from "./layout/errors";
import { pointerAngle } from "./layout/polar-angle";
import type { Sweep } from "./layout/polar-angle";
import { nearestVertex, radarDomain, radarRadius, radarVertices, spokeAngle, spokeAt } from "./layout/radar";
import { seriesOf } from "./layout/series-of";
import { slotX } from "./layout/x-domain";

/** The most series a radar compares, CONTRACT section 8.4's cap. */
export const RADAR_SERIES_CAP = 4;

/** What a radar model reads from its Root. */
export type RadarInput = {
  readonly model: CartesianModel;
  readonly config: ChartConfig;
  readonly rows: readonly ChartRow[];
  readonly locale: SupportedLocale;
  readonly sweep: Sweep;
  /** Root's `max`, or undefined. */
  readonly max: number | undefined;
  /** Root's `aria-label`, which the table's caption reads. */
  readonly name: string | undefined;
  /** The data rules the Root's rows broke, which production warns once each. */
  readonly issues: readonly PolarIssue[];
};

/**
 * A swatch's paint: the active reading's step, a role list's stops as a gradient, a scale's ramp, a
 * threshold's two sides split in half, lower side first, or the series' own paint.
 */
function swatchOf(context: TextContext, key: string, at: number | null): string {
  const paint = seriesPaintOf(key, context.config[key]?.color ?? "chart-1", seriesOf(context.model, key));
  const step = at === null ? undefined : readingPaint(paint, readingAt(context, key, at));
  if (step !== undefined) return step;
  const { stops, ramp } = paint;
  if (stops !== undefined) return `linear-gradient(to right, ${stops.join(", ")})`;
  if (ramp === undefined) return paint.base;
  if (!isThresholdColor(paint.color)) return `linear-gradient(to right, ${ramp.join(", ")})`;
  const [below = paint.base, above = paint.base] = ramp;
  return `linear-gradient(to right, ${below} 50%, ${above} 50%)`;
}

/** A threshold's two sides, upper first as the legend lists them, or null for any other colour. */
function sidesOf(color: ChartColor | undefined): readonly [ChartThresholdSide, ChartThresholdSide] | null {
  return color !== undefined && isThresholdColor(color) ? [color.above, color.below] : null;
}

/** The spoken extremes of each series, the radar description's sentences after its opening. */
function seriesSentences(context: TextContext): string[] {
  const { locale, model } = context;
  const strings = CHART_STRINGS[locale];
  return model.series.flatMap(({ key, readings }) => {
    let low: { readonly slot: number; readonly value: number } | null = null;
    let high: { readonly slot: number; readonly value: number } | null = null;
    for (const [slot, reading] of readings.entries()) {
      if (reading.kind !== "reading") continue;
      if (low === null || reading.value < low.value) low = { slot, value: reading.value };
      if (high === null || reading.value > high.value) high = { slot, value: reading.value };
    }
    if (low === null || high === null) return [];
    const format = context.config[key]?.format ?? {};
    const spoken = (value: number) => formatValue(locale, value, format, "full").spoken;
    return [
      strings.descriptionSeries(
        seriesLabel(context, key).spoken,
        spoken(low.value),
        slotLabel(context, low.slot).spoken,
        spoken(high.value),
        slotLabel(context, high.slot).spoken
      ),
    ];
  });
}

/**
 * A radar's model: one spoke per category, the series as polygons over a radius domain that never
 * clamps a reading, with the cartesian option grammar, the description, the pick by nearest spoke
 * and then nearest vertex, and the series table.
 *
 * @param input - The Root's cartesian model over its spokes, config, rows and props.
 * @returns The model.
 */
export function radarModel(input: RadarInput): PolarModel {
  const { model, config, locale, sweep } = input;
  const context: TextContext = { config, locale, model, xFormat: undefined, now: undefined };
  const strings = CHART_STRINGS[locale];
  const polarStrings = POLAR_STRINGS[locale];
  const count = model.domain.kind === "category" ? model.domain.names.length : 0;
  const values = model.series.flatMap(({ readings }) =>
    readings.flatMap((reading) => (reading.kind === "reading" ? [reading.value] : []))
  );
  const { domain, ticks } = radarDomain(values, input.max);
  const radius = radarRadius(domain, 1);
  const vertices = model.series.map(({ readings }) =>
    radarVertices(
      readings.map((reading) => (reading.kind === "reading" ? reading.value : null)),
      radius
    )
  );
  const keys = model.domain.kind === "category" ? model.domain.names : [];
  const empty = model.empty;
  return {
    family: "radar",
    sweep,
    count,
    keys,
    empty,
    description: empty
      ? `${strings.noData}.`
      : [
          polarStrings.descriptionRadar(
            countOf(locale, model.series.length, polarStrings.seriesWord),
            countOf(locale, count, strings.slots.category)
          ),
          ...seriesSentences(context),
        ].join(" "),
    instructions: "cartesian",
    orientation: "horizontal",
    wrap: true,
    series: model.series.length,
    page: null,
    optionName: (index, focus, order) => optionName(context, index, focus, order),
    pick: (point) => {
      // Distance from the centre changes nothing, as R6 says.
      if (count === 0) return null;
      const spoke = spokeAt(pointerAngle(point.x, point.y), count);
      const near =
        model.series.length > 1
          ? nearestVertex(
              point,
              vertices.map((series) => series[spoke] ?? null)
            )
          : null;
      return { slot: spoke, near };
    },
    ray: (index) => (index < 0 || index >= count ? null : { angle: spokeAngle(index, count), radius: 1 }),
    selectKey: (_index, focus) => model.series[focus]?.key ?? null,
    selectable: Object.keys(config),
    table: seriesTable({ ...context, name: input.name, rows: input.rows }, keys),
    readout: (kernel) => seriesReadout(context, kernel),
    issues: input.issues,
    drawing: {
      kind: "radar",
      radar: {
        count,
        labels: keys.map((_, index) => slotLabel(context, index)),
        domain,
        ticks,
        zero: domain[0] < 0 ? radius(0) : null,
        series: model.series.map(({ key, readings }, index) => {
          const color = config[key]?.color;
          return {
            key,
            index,
            paint: seriesPaint(key, singleRole(color)),
            stops:
              color !== undefined && isRoleList(color)
                ? color.map((stop) => seriesPaint(key, stop))
                : undefined,
            values: readings.map((reading) => (reading.kind === "reading" ? reading.value : null)),
            qualities: readings.map((reading) =>
              reading.kind === "missing"
                ? "missing"
                : reading.kind === "reading" && reading.quality !== "measured"
                  ? reading.quality
                  : undefined
            ),
          };
        }),
        format: config[model.series[0]?.key ?? ""]?.format ?? {},
      },
    },
  };
}

/**
 * A series family's readout, a radar's or a clock's: the cartesian series readout over the family's
 * slots, a threshold series listing both sides in the legend.
 *
 * @param context - The family's series model and words.
 * @param kernel - The polar Root's kernel.
 * @returns The readout.
 */
export function seriesReadout(context: TextContext, kernel: PolarKernel): ChartReadout {
  const { model, config } = context;
  const legendKeys = Object.keys(config);
  const seriesKeys = model.series.map(({ key }) => key);
  const items = new Map(
    legendKeys.map((key, index): [string, ReadoutItem] => [
      key,
      {
        index: seriesOf(model, key)?.seriesIndex ?? index,
        label: seriesLabel(context, key),
        icon: config[key]?.icon,
        selectable: true,
        sides: sidesOf(config[key]?.color),
      },
    ])
  );
  return {
    id: kernel.id,
    name: kernel.name,
    locale: context.locale,
    root: kernel.root,
    store: kernel.store,
    followers: kernel.followers,
    window: model.window,
    empty: model.empty,
    legendKeys,
    toggleGroupName: CHART_STRINGS[context.locale].seriesGroup,
    item: (key) => items.get(key),
    assertKey: (part, key) => {
      assertKnownKey(part, config, key);
    },
    pointKey: (_active, near) => (near === null ? null : (model.series[near]?.key ?? null)),
    itemsFollowActive: false,
    tooltipKeys: () => seriesKeys,
    activeLabel: (active, format) => slotLabel(context, active, format).text,
    valueText: (key, at, format) => readingText(context, key, at, format),
    share: (key, at, digits) => slotShares(context, at, digits).get(key) ?? null,
    legendAt: (key, active, fallback) => active ?? fallbackSlot(context, key, fallback),
    legendShare: (key, digits) => windowShares(context, digits).get(key) ?? null,
    swatch: (key, at) => ({ paint: swatchOf(context, key, at), look: undefined }),
    point: (active, near) => {
      const values: Record<string, number | null> = {};
      const quality: Record<string, ChartQuality> = {};
      for (const series of model.series) {
        const reading = series.readings[active];
        values[series.key] = reading?.kind === "reading" ? reading.value : null;
        if (reading?.kind === "reading") quality[series.key] = reading.quality;
        else if (reading?.kind === "missing") quality[series.key] = "missing";
      }
      return {
        index: active,
        x: slotX(model.domain, active),
        label: slotLabel(context, active),
        key: near === null ? null : (model.series[near]?.key ?? null),
        values,
        quality,
      };
    },
    select: kernel.select,
    registerToggleGroup: kernel.registerToggleGroup,
    highlight: kernel.highlight,
    warnOnce: kernel.warnOnce,
    usePick: kernel.usePick,
  };
}
