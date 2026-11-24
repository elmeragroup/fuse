"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { createTickList, writeAttribute, writeStyle } from "./chart-dom";
import type { TickList } from "./chart-dom";
import { sameShallow, useSteady } from "./chart-steady";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { offsetAt } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { labelBound } from "./layout/label-bound";
import { labelWidth } from "./layout/label-width";
import { linearScale, scaleTicks } from "./layout/linear-scale";
import type { LiveFeed, LiveFrame, LiveMode } from "./layout/live-clock";
import {
  edgeFade,
  liveDomain,
  liveExtent,
  livePixel,
  liveValueTicks,
  liveY,
  tickStep,
  timeShare,
  timeTicks,
} from "./layout/live-window";
import type { LiveGeometry, LiveWindow } from "./layout/live-window";
import { hairline } from "./layout/plot-frame";
import { domainShare } from "./layout/tick-fit";
import { useLiveFrame, useLivePlot, useLiveRoot, useShownFeed } from "./live-line-chart-context";
import { WidestSizer } from "./live-line-chart-sizer";
import { latestWindow, liveTimeText } from "./live-line-chart-text";
import type { LiveLineChartTimeFormat } from "./live-line-chart-text";

/**
 * Props for `LiveLineChart.Grid`, a closed part.
 *
 * @beta
 */
export type LiveLineChartGridProps = ChartLayerProps & {
  /** The line style, solid or dashed. */
  variant?: "solid" | "dashed";
};

/**
 * Props for `LiveLineChart.XAxis`, a closed part.
 *
 * @beta
 */
export type LiveLineChartXAxisProps = ChartLayerProps & {
  /**
   * The tick label format. By default ticks under a minute apart print `"time-seconds"`, such as
   * `13:42:05`, and wider ones `"time"`, such as `13:42`.
   */
  format?: LiveLineChartTimeFormat;
};

/**
 * Props for `LiveLineChart.YAxis`, a closed part.
 *
 * @beta
 */
export type LiveLineChartYAxisProps = ChartLayerProps & {
  /** The tick label format. Defaults to Root's `valueFormat`. */
  format?: ValueFormat;
  /**
   * `"start"` draws the axis at the left edge and `"end"` at the right. With a `Badge`, keep it at
   * `"start"`, since the badge takes the end column.
   */
  side?: "start" | "end";
};

/** The value ticks a domain aims for. */
const VALUE_TICKS = 5;

/** How far, in CSS pixels, a time tick fades in at the right edge and out at the left. */
const TICK_FADE_PX = 40;

/** The font size, in px, of the labels whose widths `labelWidth` estimates and `labelBound` bounds. */
const ESTIMATE_PX = 12;

/** How far, in CSS pixels, a value tick or grid line fades out at the plot's top and bottom edges. */
const VALUE_FADE_PX = 16;

/** The least room, in CSS pixels, between two time labels. */
const TICK_GAP_PX = 32;

/** The value ticks of a domain at rest, at d3's nice steps. */
function valueTicks(domain: readonly [number, number]): number[] {
  return scaleTicks(linearScale(domain, [0, 1]), VALUE_TICKS);
}

/** The share of the plot's height a value tick's edge fade spans. */
function valueFade(geometry: LiveGeometry): number {
  return geometry.height <= 0 ? 1 : VALUE_FADE_PX / geometry.height;
}

/**
 * How opaque a value tick at a height draws. It fades over `VALUE_FADE_PX` at either edge, as a time
 * tick fades at the sides, so a tick the gliding domain carries past an edge leaves without a pop.
 */
function valueTickOpacity(geometry: LiveGeometry, y: number): number {
  return edgeFade(1 - y / geometry.height, valueFade(geometry));
}

/**
 * The value ticks a frame shows, at the step of the domain they come to rest in: the domain where
 * the glide ends under a live clock, and the shown domain under a paused or still one, which draws
 * no glide. A muted label falls under 4.5:1 below about 0.95 opacity, so a tick inside the resting
 * domain shows only if it rests opaque there. A tick beyond the resting domain leaves as the domain
 * contracts, and fades as it reaches the shown domain's edge. It joins only while it draws opaque,
 * so a tick left out at rest does not come back to leave, and once shown it stays. A tick left out
 * fades out as it leaves its list, while the frame still places it.
 *
 * @param shown - The ticks the part showed in the last frame.
 */
function frameValueTicks(
  frame: LiveFrame,
  geometry: LiveGeometry,
  mode: LiveMode,
  shown: readonly number[]
): number[] {
  const rest = mode === "live" ? frame.rest : frame.domain;
  const [low, high] = rest;
  const fade = valueFade(geometry);
  return liveValueTicks(rest, frame.domain, VALUE_TICKS).filter((value) =>
    value < low || value > high
      ? shown.includes(value) || valueTickOpacity(geometry, liveY(geometry, value)) === 1
      : edgeFade(domainShare(rest, value), fade) === 1
  );
}

/**
 * The tick nearest the window's middle, when its label, centered on it, fits inside the plot.
 *
 * @param measure - The width of a tick's label, in CSS pixels.
 */
function centerTick(
  ticks: readonly number[],
  window: LiveWindow,
  width: number,
  measure: (time: number) => number
): number | undefined {
  if (ticks.length === 0) return undefined;
  const off = (time: number) => Math.abs(timeShare(window, time) - 0.5);
  const nearest = ticks.reduce((best, time) => (off(time) < off(best) ? time : best));
  const share = timeShare(window, nearest);
  return measure(nearest) / 2 <= width * Math.min(share, 1 - share) ? nearest : undefined;
}

/** An axis's labels and what they print in, so a change of either makes every label again. */
type Labels<TFormat> = {
  readonly list: TickList;
  readonly locale: SupportedLocale;
  readonly timeZone: string;
  readonly format: TFormat;
};

/**
 * An axis's labels under a parent for a locale, a zone and a format. It keeps the labels it has
 * while they print the same, and otherwise makes a new list and drops the old one's labels.
 */
function labelsFor<TFormat>(
  held: Labels<TFormat> | null,
  parent: Element,
  locale: SupportedLocale,
  timeZone: string,
  format: TFormat,
  text: (key: number) => string,
  slot: string
): Labels<TFormat> {
  if (held?.locale === locale && held.timeZone === timeZone && held.format === format) return held;
  held?.list.clear();
  const list = createTickList(parent, (key) => {
    const label = parent.ownerDocument.createElement("span");
    label.setAttribute("data-slot", slot);
    label.textContent = text(key);
    return label;
  });
  return { list, locale, timeZone, format };
}

/**
 * Horizontal lines at the value ticks, behind the marks, which slide as the value axis eases to fit
 * the readings. The lines keep the step of the domain the glide comes to rest at, or of the domain a
 * paused Root shows, fade out over the last 16 px at the plot's top and bottom edges, and fade in and
 * out over 150 ms as they enter or leave. The grid leaves out a line whose resting place is inside
 * that 16 px, as the value axis leaves out its tick, so a line at rest is opaque once its fade ends.
 * Every line is a hairline, 1 px rounded down to whole device pixels.
 *
 * @beta
 */
export function LiveLineChartGrid({
  variant = "solid",
  className,
  style,
}: LiveLineChartGridProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.Grid");
  const plot = useLivePlot(context);
  const layer = useRef<SVGSVGElement>(null);
  const lines = useRef<TickList | null>(null);
  const shownTicks = useRef<readonly number[]>([]);
  const { mode } = context;
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = layer.current;
    if (node === null) return;
    lines.current ??= createTickList(node, () => {
      const line = node.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("data-slot", "chart-grid-line");
      line.setAttribute("data-axis", "value");
      return line;
    });
    shownTicks.current = frameValueTicks(frame, geometry, mode, shownTicks.current);
    // Every mounted line, a leaving one included, takes its place in this frame from its value.
    for (const [value, line] of lines.current.sync(shownTicks.current)) {
      const y = liveY(geometry, value);
      writeAttribute(line, "x1", 0);
      writeAttribute(line, "x2", geometry.width);
      writeAttribute(line, "y1", y);
      writeAttribute(line, "y2", y);
      writeStyle(line, "opacity", String(valueTickOpacity(geometry, y)));
    }
  });
  return (
    <svg
      ref={layer}
      data-slot="chart-grid"
      // The live chart's own lines, which its stylesheet fades, are this grid's children.
      data-live=""
      data-variant={variant}
      data-direction="horizontal"
      aria-hidden="true"
      className={className}
      style={plot === null ? style : { "--_rule-width": `${String(hairline(plot.box))}px`, ...style }}
    />
  );
}

/**
 * The time axis along the bottom, whose ticks land on round wall-clock times in the market's zone
 * and scroll with the window. A tick fades in as it enters at the right edge and out as it leaves at
 * the left. While the window holds still, the axis leaves out a tick inside either fade, so every
 * label it draws is opaque, and when that leaves no tick it keeps the one nearest the middle if its
 * label fits. The window holds while Root is `paused`, while the clock waits out a lead from
 * readings stamped ahead of the wall clock, and under reduced motion, where the window redraws on a
 * new reading and when `value` or `windowMs` changes. The axis picks the finest round step whose
 * labels fit its width. It is plot output, so it is hidden from screen readers, which read the
 * times from the plot's option and the table.
 *
 * @beta
 */
export function LiveLineChartXAxis({ format, className, style }: LiveLineChartXAxisProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.XAxis");
  const plot = useLivePlot(context);
  const axis = useRef<HTMLDivElement>(null);
  const labels = useRef<Labels<LiveLineChartTimeFormat> | null>(null);
  const { text, mode } = context;
  // Inline Intl options that name the same fields are no change.
  const ownFormat = useSteady(format, sameShallow);
  // The widest label a tick of each format prints, which sets how many ticks fit.
  const widths = useMemo(() => {
    const sample = Date.UTC(2026, 9, 16, 22, 58, 58);
    const width = (preset: LiveLineChartTimeFormat) =>
      labelWidth(liveTimeText(text, sample, "tick", ownFormat ?? preset).text);
    return { seconds: width("time-seconds"), minutes: width("time") };
  }, [text, ownFormat]);
  // The axis's font size over the 12 px of the estimate and the bound, which a larger root size or
  // text zoom raises. The axis's height is set in rem, so a change of either resizes it, and the
  // resize reads the size again outside the frame loop.
  const [textScale, setTextScale] = useState(1);
  useLayoutEffect(() => {
    const node = axis.current;
    if (node === null) return undefined;
    const read = (): void => {
      const size = Number.parseFloat(getComputedStyle(node).fontSize);
      setTextScale(size > 0 ? size / ESTIMATE_PX : 1);
    };
    read();
    const sizes = new ResizeObserver(read);
    sizes.observe(node);
    return () => {
      sizes.disconnect();
    };
  }, []);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = axis.current;
    if (node === null || geometry.width <= 0) return;
    const { duration } = frame.feed;
    const fine = tickStep(duration, Math.floor(geometry.width / (widths.seconds + TICK_GAP_PX)));
    const step =
      fine < 60_000 ? fine : tickStep(duration, Math.floor(geometry.width / (widths.minutes + TICK_GAP_PX)));
    // A step that crosses a minute changes the labels' format, which makes every label again.
    const preset: LiveLineChartTimeFormat = ownFormat ?? (step < 60_000 ? "time-seconds" : "time");
    const tickText = (time: number) => liveTimeText(text, time, "tick", preset).text;
    const shown = labelsFor(
      labels.current,
      node,
      text.locale,
      text.timeZone,
      preset,
      tickText,
      "chart-x-tick"
    );
    labels.current = shown;
    const fade = TICK_FADE_PX / geometry.width;
    const all = timeTicks(frame.window, step, offsetAt(frame.window.end, text.timeZone));
    // A tick in a window that stays put rests where it is, so the axis leaves out one that would
    // rest partly faded. When that leaves no tick, it keeps the one nearest the middle, opaque, if
    // its label fits at the axis's font size in any common sans.
    const stays = mode !== "live" || frame.holds;
    const opaque = stays ? all.filter((time) => edgeFade(timeShare(frame.window, time), fade) === 1) : all;
    const kept =
      opaque.length > 0
        ? undefined
        : centerTick(all, frame.window, geometry.width, (time) => labelBound(tickText(time)) * textScale);
    const ticks = kept === undefined ? opaque : [kept];
    for (const [time, label] of shown.list.sync(ticks)) {
      const share = timeShare(frame.window, time);
      writeStyle(label, "--chart-at", String(share));
      writeStyle(label, "opacity", String(time === kept ? 1 : edgeFade(share, fade)));
    }
  });
  return (
    <div
      ref={axis}
      data-slot="chart-x-axis"
      // The live chart's own labels, which its stylesheet moves, are this axis's children.
      data-live=""
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}

/**
 * The value axis at the left edge, or the right under `side="end"`, whose ticks sit at d3's nice
 * steps and slide as the domain eases to fit the readings. The ticks keep the step of the domain
 * the glide comes to rest at, or of the domain a paused Root shows, fade out over the last 16 px at
 * the plot's top and bottom edges, and fade in and out over 150 ms as they enter or leave. The axis
 * leaves out a tick whose resting place is inside that 16 px, so a tick at rest is opaque once its
 * fade ends. A hidden sizer holds the labels of the domain the latest readings fit, and the widest
 * label it has held under the format and the locale, so the axis column takes their width on the
 * server and in every engine alike, and only grows.
 *
 * @beta
 */
export function LiveLineChartYAxis({
  format,
  side = "start",
  className,
  style,
}: LiveLineChartYAxisProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.YAxis");
  const plot = useLivePlot(context);
  const axis = useRef<HTMLDivElement>(null);
  const labels = useRef<Labels<ValueFormat> | null>(null);
  // Root's format is steady already, and inline options that name the same fields are no change.
  const valueFormat = useSteady(format, sameShallow) ?? context.text.valueFormat;
  const { locale, timeZone } = context.text;
  const feed = useShownFeed(context);
  const sizer = useMemo(() => sizerLabels(feed, locale, valueFormat), [feed, locale, valueFormat]);
  const shownTicks = useRef<readonly number[]>([]);
  const { mode } = context;
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = axis.current;
    if (node === null) return;
    const shown = labelsFor(
      labels.current,
      node,
      locale,
      timeZone,
      valueFormat,
      (value) => formatValue(locale, value, valueFormat, "tick").text,
      "chart-y-tick"
    );
    labels.current = shown;
    shownTicks.current = frameValueTicks(frame, geometry, mode, shownTicks.current);
    // Every mounted label, a leaving one included, takes its place in this frame from its value,
    // centered on its height by a translation, so a frame lays nothing out.
    for (const [value, label] of shown.list.sync(shownTicks.current)) {
      const y = liveY(geometry, value);
      writeStyle(label, "translate", `0 calc(${livePixel(y)}px - 50%)`);
      writeStyle(label, "opacity", String(valueTickOpacity(geometry, y)));
    }
  });
  return (
    <div
      data-slot="chart-y-axis"
      // The live chart's own labels, which its stylesheet moves and fades, are this axis's ticks.
      data-live=""
      data-side={side}
      aria-hidden="true"
      className={className}
      style={style}>
      <WidestSizer texts={sizer} locale={locale} format={valueFormat} />
      <div ref={axis} data-part="ticks" />
    </div>
  );
}

/** The tick labels of the domain the latest window's readings fit, which size the axis column. */
function sizerLabels(feed: LiveFeed, locale: SupportedLocale, format: ValueFormat): string[] {
  if (feed.tip === null) return [];
  const extent = liveExtent(feed.points, latestWindow(feed.points, feed.duration), feed.tip);
  return valueTicks(liveDomain(extent)).map((value) => formatValue(locale, value, format, "tick").text);
}

Object.assign(LiveLineChartGrid, { displayName: "LiveLineChart.Grid" });
Object.assign(LiveLineChartXAxis, { displayName: "LiveLineChart.XAxis" });
Object.assign(LiveLineChartYAxis, { displayName: "LiveLineChart.YAxis" });
