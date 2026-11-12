"use client";

import { useMemo, useRef } from "react";
import type { ReactElement } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { writeAttribute, writeStyle } from "./chart-dom";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { wallTimes } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { labelWidth } from "./layout/label-width";
import { linearScale, scaleTicks } from "./layout/linear-scale";
import type { LiveFeed } from "./layout/live-clock";
import { edgeFade, liveDomain, liveExtent, tickStep, timeShare, timeTicks } from "./layout/live-window";
import type { LiveGeometry } from "./layout/live-window";
import { hairline } from "./layout/plot-frame";
import { useLiveFrame, useLivePlot, useLiveRoot, useShownFeed } from "./live-line-chart-context";
import { latestWindow, liveTimeText } from "./live-line-chart-text";
import type { LiveLineChartTimeFormat } from "./live-line-chart-text";

/**
 * Props for `LiveLineChart.Grid`, a closed part.
 *
 * @beta
 */
export type LiveLineChartGridProps = ChartLayerProps & {
  /** The line style. "solid" by default. */
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
  /** The tick label format. Root's `valueFormat` by default. */
  format?: ValueFormat;
  /** "start" draws the axis at the left edge and "end" at the right. "start" by default. */
  side?: "start" | "end";
};

/** The value ticks a domain aims for. */
const VALUE_TICKS = 5;

/** How far, in CSS pixels, a time tick fades in at the right edge and out at the left. */
const TICK_FADE_PX = 40;

/** The least room, in CSS pixels, between two time labels. */
const TICK_GAP_PX = 32;

/** The value ticks of a domain, at d3's nice steps. */
function valueTicks(domain: readonly [number, number]): number[] {
  return scaleTicks(linearScale(domain, [0, 1]), VALUE_TICKS);
}

/** A tick's element: a grid line or an axis label. */
type TickNode = HTMLElement | SVGElement;

/** The tick elements each parent holds, by key, which only `keyedChildren` adds and removes. */
const tickNodes = new WeakMap<Element, Map<number, TickNode>>();

/**
 * Keep one child per key under a parent: make the missing ones, drop the ones no key names, and
 * return each key's child. A frame writes only the children whose keys change, so a tick that
 * stays keeps its element and its text.
 */
function keyedChildren(
  parent: Element,
  keys: readonly number[],
  make: (key: number) => TickNode
): ReadonlyMap<number, TickNode> {
  const kept = tickNodes.get(parent) ?? new Map<number, TickNode>();
  tickNodes.set(parent, kept);
  const wanted = new Set(keys);
  for (const [key, child] of kept) {
    if (wanted.has(key)) continue;
    child.remove();
    kept.delete(key);
  }
  for (const key of keys) {
    if (kept.has(key)) continue;
    const child = make(key);
    parent.append(child);
    kept.set(key, child);
  }
  return kept;
}

/** Drop every tick a parent holds, so the next frame makes them again, as a new label format needs. */
function dropChildren(parent: Element): void {
  for (const child of tickNodes.get(parent)?.values() ?? []) child.remove();
  tickNodes.delete(parent);
}

/** A value's place from the plot's top, as a share of its height. */
function topShare(geometry: LiveGeometry, value: number): number {
  const [low, high] = geometry.domain;
  return high === low ? 0.5 : (high - value) / (high - low);
}

/**
 * Horizontal lines at the value ticks, behind the marks, which slide as the value axis eases to fit
 * the readings. Every line is a hairline, 1 px rounded down to whole device pixels.
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
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = layer.current;
    if (node === null) return;
    const ticks = valueTicks(frame.domain);
    const lines = keyedChildren(node, ticks, () => {
      const line = node.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("data-slot", "chart-grid-line");
      line.setAttribute("data-axis", "value");
      return line;
    });
    for (const [value, line] of lines) {
      const y = topShare(geometry, value) * geometry.height;
      writeAttribute(line, "x1", 0);
      writeAttribute(line, "x2", geometry.width);
      writeAttribute(line, "y1", y);
      writeAttribute(line, "y2", y);
    }
  });
  return (
    <svg
      ref={layer}
      data-slot="chart-grid"
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
 * the left, and the axis picks the finest round step whose labels fit its width. It is plot output,
 * so it is hidden from screen readers, which read the times from the plot's option and the table.
 *
 * @beta
 */
export function LiveLineChartXAxis({ format, className, style }: LiveLineChartXAxisProps): ReactElement {
  const context = useLiveRoot("LiveLineChart.XAxis");
  const plot = useLivePlot(context);
  const axis = useRef<HTMLDivElement>(null);
  // The zone's offset, read once a minute, since a frame is too often to ask Intl.
  const offset = useRef<{ readonly at: number; readonly timeZone: string; readonly value: number } | null>(
    null
  );
  const { text } = context;
  // The widest label a tick of each format prints, which sets how many ticks fit.
  const widths = useMemo(() => {
    const sample = Date.UTC(2026, 9, 16, 22, 58, 58);
    const width = (preset: LiveLineChartTimeFormat) =>
      labelWidth(liveTimeText(text, sample, "tick", format ?? preset).text);
    return { seconds: width("time-seconds"), minutes: width("time") };
  }, [text, format]);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = axis.current;
    if (node === null || geometry.width <= 0) return;
    const minute = Math.floor(frame.now / 60_000) * 60_000;
    const { timeZone } = text;
    if (offset.current?.at !== minute || offset.current.timeZone !== timeZone) {
      offset.current = { at: minute, timeZone, value: (wallTimes([minute], timeZone)[0] ?? minute) - minute };
    }
    const { duration } = frame.feed;
    const fine = tickStep(duration, Math.floor(geometry.width / (widths.seconds + TICK_GAP_PX)));
    const step =
      fine < 60_000 ? fine : tickStep(duration, Math.floor(geometry.width / (widths.minutes + TICK_GAP_PX)));
    const preset: LiveLineChartTimeFormat = format ?? (step < 60_000 ? "time-seconds" : "time");
    // A step that crosses a minute changes the labels' format, so every tick is made again.
    const labelFormat = JSON.stringify(preset);
    if (node.getAttribute("data-format") !== labelFormat) {
      dropChildren(node);
      node.setAttribute("data-format", labelFormat);
    }
    const ticks = timeTicks(frame.window, step, offset.current.value);
    const labels = keyedChildren(node, ticks, (time) => {
      const label = node.ownerDocument.createElement("span");
      label.setAttribute("data-slot", "chart-x-tick");
      label.textContent = liveTimeText(text, time, "tick", preset).text;
      return label;
    });
    const fade = TICK_FADE_PX / geometry.width;
    for (const [time, label] of labels) {
      const share = timeShare(frame.window, time);
      writeStyle(label, "--chart-at", String(share));
      writeStyle(label, "opacity", String(edgeFade(share, fade)));
    }
  });
  // A locale, a zone or a format that changes relabels every tick, so the axis starts over.
  const key = `${text.locale}-${text.timeZone}-${JSON.stringify(format ?? null)}`;
  return (
    <div
      key={key}
      ref={axis}
      data-slot="chart-x-axis"
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}

/**
 * The value axis at the left edge, or the right under `side="end"`, whose ticks sit at d3's nice
 * steps and slide as the domain eases to fit the readings. A hidden sizer holds the labels of the
 * domain the latest readings fit, so the axis column takes their width on the server and in every
 * engine alike.
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
  const valueFormat = format ?? context.text.valueFormat;
  const { locale } = context.text;
  const feed = useShownFeed(context);
  const sizer = useMemo(() => sizerLabels(feed, locale, valueFormat), [feed, locale, valueFormat]);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = axis.current;
    if (node === null) return;
    const labels = keyedChildren(node, valueTicks(frame.domain), (value) => {
      const label = node.ownerDocument.createElement("span");
      label.setAttribute("data-slot", "chart-y-tick");
      label.textContent = formatValue(locale, value, valueFormat, "tick").text;
      return label;
    });
    for (const [value, label] of labels) {
      writeStyle(label, "--chart-at", `${String(topShare(geometry, value) * 100)}%`);
    }
  });
  return (
    <div data-slot="chart-y-axis" data-side={side} aria-hidden="true" className={className} style={style}>
      <span data-slot="chart-axis-sizer">
        {sizer.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </span>
      {/* A locale or a format that changes relabels every tick, so the ticks start over. */}
      <div key={`${locale}-${JSON.stringify(valueFormat)}`} ref={axis} data-part="ticks" />
    </div>
  );
}

/** The tick labels of the domain the latest window's readings fit, which size the axis column. */
function sizerLabels(feed: LiveFeed, locale: SupportedLocale, format: ValueFormat): string[] {
  const extent = liveExtent(feed.points, latestWindow(feed.points, feed.duration), feed.tip);
  if (extent === null) return [];
  return valueTicks(liveDomain(extent)).map((value) => formatValue(locale, value, format, "tick").text);
}

Object.assign(LiveLineChartGrid, { displayName: "LiveLineChart.Grid" });
Object.assign(LiveLineChartXAxis, { displayName: "LiveLineChart.XAxis" });
Object.assign(LiveLineChartYAxis, { displayName: "LiveLineChart.YAxis" });
