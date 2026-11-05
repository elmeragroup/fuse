"use client";

import type { ChartRootContextValue } from "./chart-context";
import { readingPaint, seriesPaintOf } from "./chart-paint";
import type { SeriesPaint } from "./chart-paint";
import { useCartesianPick } from "./chart-pick";
import type { ChartReadout, ReadoutItem } from "./chart-readout-port";
import { fallbackSlot, readingAt, readingText, slotShares, windowShares } from "./chart-series-readout";
import { slotLabel } from "./chart-text";
import type { ChartQuality } from "./chart-types";
/**
 * A cartesian Root's readout: the port the shared parts read, over Root's series model and its
 * pick. An index is a slot, the legend lists every config key, and the tooltip rows list every
 * series at the active slot.
 */
import { CHART_STRINGS } from "./format/chart-strings";
import { seriesLabel } from "./format/series-label";
import { barForm, drawnBarVariant } from "./layout/bar-geometry";
import { isThresholdColor } from "./layout/color-key";
import { assertKnownKey } from "./layout/errors";
import { seriesOf } from "./layout/series-of";
import { slotX } from "./layout/x-domain";

/**
 * The CSS paint of a swatch, the marks' own stops: a role paints itself, a role list its roles as a
 * gradient, a scale its 7-step ramp and a threshold its two sides split in half, lower side first.
 * A step the active value picks paints alone.
 */
function swatchPaint(paint: SeriesPaint, step: string | undefined): string {
  if (step !== undefined) return step;
  const { stops, ramp } = paint;
  if (stops !== undefined) return `linear-gradient(to right, ${stops.join(", ")})`;
  if (ramp === undefined) return paint.base;
  if (!isThresholdColor(paint.color)) return `linear-gradient(to right, ${ramp.join(", ")})`;
  const [below = paint.base, above = paint.base] = ramp;
  return `linear-gradient(to right, ${below} 50%, ${above} 50%)`;
}

/**
 * Build a cartesian Root's readout. Root memoises it on its context, so it changes with data,
 * config and the effective window, and never with the pointer.
 *
 * @param context - The Root.
 * @returns The readout.
 */
export function cartesianReadout(context: ChartRootContextValue): ChartReadout {
  const { model, config, orientation } = context;
  const legendKeys = Object.keys(config);
  const seriesKeys = model.series.map(({ key }) => key);
  const items = new Map<string, ReadoutItem>();
  const item = (key: string): ReadoutItem | undefined => {
    const known = items.get(key);
    if (known !== undefined) return known;
    const entry = config[key];
    if (entry === undefined) return undefined;
    const color = entry.color;
    const made: ReadoutItem = {
      index: seriesOf(model, key)?.seriesIndex ?? legendKeys.indexOf(key),
      label: seriesLabel(context, key),
      icon: entry.icon,
      selectable: true,
      sides: isThresholdColor(color) ? [color.above, color.below] : null,
    };
    items.set(key, made);
    return made;
  };
  return {
    id: context.id,
    name: context.name,
    locale: context.locale,
    root: context.root,
    store: context.store,
    followers: context.followers,
    window: model.window,
    empty: model.empty,
    legendKeys,
    toggleGroupName: CHART_STRINGS[context.locale].seriesGroup,
    item,
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
    swatch: (key, at) => {
      const series = seriesOf(model, key);
      const paint = seriesPaintOf(key, config[key]?.color ?? "chart-1", series);
      const step = at === null ? undefined : readingPaint(paint, readingAt(context, key, at));
      // The swatch wears the look the series' bars draw in, from config at render time, so the
      // server HTML and the legend tell a hatched series apart before the chart hydrates.
      const look = drawnBarVariant(config[key]?.barVariant ?? "default", barForm(model, orientation));
      return { paint: swatchPaint(paint, step), look: look === "default" ? undefined : look };
    },
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
    select: context.select,
    registerToggleGroup: context.registerToggleGroup,
    highlight: context.highlight,
    warnOnce: context.warnOnce,
    usePick: () => useCartesianPick(context, "Chart.Tooltip"),
  };
}
