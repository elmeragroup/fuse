"use client";

import { useMemo, useRef } from "react";
import type { ReactElement } from "react";

import type { SupportedLocale } from "../../intl/locale-context";
import { createTickList, writeAttribute, writeStyle } from "./chart-dom";
import type { TickList } from "./chart-dom";
import { sameShallow, useSteady } from "./chart-steady";
import type { ChartLayerProps, ValueFormat } from "./chart-types";
import { offsetAt } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { labelWidth } from "./layout/label-width";
import { linearScale, scaleTicks } from "./layout/linear-scale";
import type { LiveFeed } from "./layout/live-clock";
import {
  edgeFade,
  liveDomain,
  liveExtent,
  liveY,
  tickStep,
  timeShare,
  timeTicks,
} from "./layout/live-window";
import { hairline } from "./layout/plot-frame";
import { valueTop } from "./layout/plot-geometry";
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

/** An axis's labels and what they print in, so a change of either makes every label again. */
type Labels<TFormat> = {
  readonly list: TickList;
  readonly locale: SupportedLocale;
  readonly timeZone: string;
  readonly format: TFormat;
};

/**
 * An axis's labels under a parent for a locale, a zone and a format: the ones it holds while they
 * print the same, else a new list, the old one's labels dropped.
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
  const lines = useRef<TickList | null>(null);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = layer.current;
    if (node === null) return;
    lines.current ??= createTickList(node, () => {
      const line = node.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("data-slot", "chart-grid-line");
      line.setAttribute("data-axis", "value");
      return line;
    });
    for (const [value, line] of lines.current.sync(valueTicks(frame.domain))) {
      const y = liveY(geometry, value);
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
  const labels = useRef<Labels<LiveLineChartTimeFormat> | null>(null);
  const { text } = context;
  // Inline Intl options that name the same fields are no change.
  const ownFormat = useSteady(format, sameShallow);
  // The widest label a tick of each format prints, which sets how many ticks fit.
  const widths = useMemo(() => {
    const sample = Date.UTC(2026, 9, 16, 22, 58, 58);
    const width = (preset: LiveLineChartTimeFormat) =>
      labelWidth(liveTimeText(text, sample, "tick", ownFormat ?? preset).text);
    return { seconds: width("time-seconds"), minutes: width("time") };
  }, [text, ownFormat]);
  useLiveFrame(context, plot, (frame, geometry) => {
    const node = axis.current;
    if (node === null || geometry.width <= 0) return;
    const { duration } = frame.feed;
    const fine = tickStep(duration, Math.floor(geometry.width / (widths.seconds + TICK_GAP_PX)));
    const step =
      fine < 60_000 ? fine : tickStep(duration, Math.floor(geometry.width / (widths.minutes + TICK_GAP_PX)));
    // A step that crosses a minute changes the labels' format, which makes every label again.
    const preset: LiveLineChartTimeFormat = ownFormat ?? (step < 60_000 ? "time-seconds" : "time");
    const shown = labelsFor(
      labels.current,
      node,
      text.locale,
      text.timeZone,
      preset,
      (time) => liveTimeText(text, time, "tick", preset).text,
      "chart-x-tick"
    );
    labels.current = shown;
    const ticks = timeTicks(frame.window, step, offsetAt(frame.window.end, text.timeZone));
    const fade = TICK_FADE_PX / geometry.width;
    for (const [time, label] of shown.list.sync(ticks)) {
      const share = timeShare(frame.window, time);
      writeStyle(label, "--chart-at", String(share));
      writeStyle(label, "opacity", String(edgeFade(share, fade)));
    }
  });
  return <div ref={axis} data-slot="chart-x-axis" aria-hidden="true" className={className} style={style} />;
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
  const labels = useRef<Labels<ValueFormat> | null>(null);
  // Root's format is steady already, and inline options that name the same fields are no change.
  const valueFormat = useSteady(format, sameShallow) ?? context.text.valueFormat;
  const { locale, timeZone } = context.text;
  const feed = useShownFeed(context);
  const sizer = useMemo(() => sizerLabels(feed, locale, valueFormat), [feed, locale, valueFormat]);
  useLiveFrame(context, plot, (frame) => {
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
    for (const [value, label] of shown.list.sync(valueTicks(frame.domain))) {
      writeStyle(label, "--chart-at", `${String(valueTop(frame.domain, value))}%`);
    }
  });
  return (
    <div data-slot="chart-y-axis" data-side={side} aria-hidden="true" className={className} style={style}>
      <span data-slot="chart-axis-sizer">
        {sizer.map(({ value, text }) => (
          <span key={value}>{text}</span>
        ))}
      </span>
      <div ref={axis} data-part="ticks" />
    </div>
  );
}

/** The tick labels of the domain the latest window's readings fit, which size the axis column. */
function sizerLabels(
  feed: LiveFeed,
  locale: SupportedLocale,
  format: ValueFormat
): { readonly value: number; readonly text: string }[] {
  if (feed.tip === null) return [];
  const extent = liveExtent(feed.points, latestWindow(feed.points, feed.duration), feed.tip);
  return valueTicks(liveDomain(extent)).map((value) => ({
    value,
    text: formatValue(locale, value, format, "tick").text,
  }));
}

Object.assign(LiveLineChartGrid, { displayName: "LiveLineChart.Grid" });
Object.assign(LiveLineChartXAxis, { displayName: "LiveLineChart.XAxis" });
Object.assign(LiveLineChartYAxis, { displayName: "LiveLineChart.YAxis" });
