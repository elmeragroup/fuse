"use client";

import type { ReactElement } from "react";

import { usePlotLayout, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import type { ChartLayerProps, ValueFormat, XFormat } from "./chart-types";
import type { Interval, TimePreset } from "./format/time-format";
import { formatSlot } from "./format/time-format";
import { formatValue } from "./format/value-format";
import { labelWidth } from "./layout/label-width";
import { slotCentre, valueTop } from "./layout/plot-geometry";
import { fitsEveryBucket, thinTicks, tickStrides } from "./layout/x-ticks";
import type { TickVisibility } from "./layout/x-ticks";

/**
 * Props for `Chart.XAxis`, a closed part.
 *
 * @beta
 */
export type ChartXAxisProps = ChartLayerProps & {
  /**
   * The tick label format. The interval's tick preset is the default. A tick that starts a coarser
   * calendar unit, such as a month start on a long axis of hours, names that unit. A clock preset
   * can't name a day, so those ticks keep their unit's default preset, such as `okt` under
   * `format="hour-range"`. A calendar preset or Intl options format them as given.
   */
  format?: XFormat;
  /** The axis title. */
  label?: string;
  /** The tick mark. "none" by default. */
  tick?: "none" | "dot";
};

/**
 * Props for `Chart.YAxis`, a closed part.
 *
 * @beta
 */
export type ChartYAxisProps = ChartLayerProps & {
  /**
   * The tick label format. The layout's first series' `format` is the default. Tick labels keep the
   * format's unit, such as `2 kWh` and `142 øre/kWh`, and leave out a price's VAT basis, which the
   * tooltip and the table print. `label` adds an axis title.
   */
  format?: ValueFormat;
  /** The axis title. */
  label?: string;
  /**
   * "start" draws the axis at the left edge, or at the bottom under `orientation="horizontal"`.
   * "end" draws it at the opposite edge. "start" by default.
   */
  side?: "start" | "end";
};

/** Each interval's default tick preset. */
const TICK_PRESETS = {
  second: "time-seconds",
  minute: "time",
  "quarter-hour": "hour",
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
  year: "year",
} as const satisfies { readonly [I in Interval]: TimePreset };

/** The presets that print a time of day, which every coarser tick unit starts at midnight. */
const CLOCK_PRESETS: ReadonlySet<XFormat> = new Set<TimePreset>([
  "hour",
  "hour-range",
  "time",
  "time-seconds",
  "time-range",
]);

/**
 * The preset of one tick. A tick of a coarser unit than the domain's is a day or longer, so a clock
 * preset gives way to the unit's own default there.
 */
function tickFormat(format: XFormat | undefined, unit: Interval, coarser: boolean): XFormat {
  if (format === undefined || (coarser && CLOCK_PRESETS.has(format))) return TICK_PRESETS[unit];
  return format;
}

/** One x tick ready to draw. */
type XTick = {
  readonly slot: number;
  readonly text: string;
  readonly at: number;
  readonly visibility: TickVisibility;
};

function xTicks(context: ChartRootContextValue, format: XFormat | undefined): XTick[] {
  const { model, locale, xScale, orientation } = context;
  const { domain, window } = model;
  if (window === null) return [];
  const inWindow = (slot: number): boolean => slot >= window.first && slot <= window.last;
  const all = tickStrides(domain).map((entry) => ({ ...entry, slots: entry.slots.filter(inWindow) }));
  const own = all.filter(
    ({ unit }) => unit === "row" || (domain.kind === "time" && unit === domain.interval)
  );
  // A slot that starts a coarser calendar unit names that unit, such as a month start on an axis
  // of hours. The coarsest unit whose strides hold the slot wins.
  const unitOf = new Map<number, Interval>();
  for (const { unit, slots } of all) {
    if (unit === "row") continue;
    for (const slot of slots) unitOf.set(slot, unit);
  }
  const text = (slot: number, coarse: boolean): string => {
    if (domain.kind === "category") return domain.names[slot] ?? "";
    const unit = coarse ? (unitOf.get(slot) ?? domain.interval) : domain.interval;
    const preset = tickFormat(format, unit, unit !== domain.interval);
    return formatSlot(locale, domain.timeZone, domain.starts[slot] ?? 0, unit, preset, "tick").text;
  };
  const position = (slot: number): number => slotCentre(window, slot, xScale);
  const measure = (coarse: boolean) => {
    // Labels format on demand, so a fit check that stops at its first overlap formats few of them.
    const labels = new Map<number, string>();
    const label = (slot: number): string => {
      const known = labels.get(slot);
      if (known !== undefined) return known;
      const made = text(slot, coarse);
      labels.set(slot, made);
      return made;
    };
    return { label, geometry: { position, width: (slot: number) => labelWidth(label(slot)) } };
  };
  // Horizontal bars give each category a row of its own, so every label shows.
  if (orientation === "horizontal") {
    const { label } = measure(false);
    return (own[0]?.slots ?? []).map((slot) => ({
      slot,
      text: label(slot),
      at: position(slot),
      visibility: "always" as const,
    }));
  }
  const fine = measure(false);
  // The interval's own strides serve while one of them fits every width bucket. Otherwise the
  // strides of coarser units join them, and their slots name the coarser unit.
  const coarse = !fitsEveryBucket(own, fine.geometry) && all.length > own.length;
  const { label, geometry } = coarse ? measure(true) : fine;
  // Only ticks that show at some width render, so a year of hours draws a few spans, not 8,760.
  return thinTicks(coarse ? all : own, geometry).flatMap(({ slot, visibility }) =>
    visibility === "none" ? [] : [{ slot, text: label(slot), at: position(slot), visibility }]
  );
}

/**
 * The visibility of each value label on an inline value axis, which horizontal bars draw along the
 * bottom. The labels thin by the x axis's width buckets and fit rule. Each stride counts from the
 * lowest tick, zero on a domain from zero, so the shown values keep one step, such as 0, 150 and
 * 300. The lowest always shows, and each fit check counts the end labels CSS clamps inward.
 */
function inlineValueTicks(
  labels: readonly { readonly value: number; readonly text: string }[],
  domain: readonly [number, number]
): TickVisibility[] {
  const count = labels.length;
  const strides = Array.from({ length: Math.max(count - 1, 1) }, (_, index) => ({
    slots: labels.flatMap((_label, slot) => (slot % (index + 1) === 0 ? [slot] : [])),
  }));
  const shown = thinTicks(strides, {
    position: (slot) => 1 - valueTop(domain, labels[slot]?.value ?? 0) / 100,
    width: (slot) => labelWidth(labels[slot]?.text ?? ""),
  });
  return labels.map((_, slot) => shown.find((tick) => tick.slot === slot)?.visibility ?? "none");
}

/**
 * The `xKey` axis in both orientations. It draws at the bottom, or at the left edge under
 * `orientation="horizontal"`. Labels never rotate. When long labels do not fit, the axis shows
 * fewer: each width bucket shows the smallest stride whose labels fit, and a wider axis never shows
 * fewer labels than a narrower one. The axis is plot output, so it is hidden from screen readers.
 *
 * @beta
 */
export function ChartXAxis({
  format,
  label,
  tick = "none",
  className,
  style,
}: ChartXAxisProps): ReactElement {
  const context = useChartRoot("Chart.XAxis");
  usePlotLayout("Chart.XAxis");
  const ticks = xTicks(context, format);
  return (
    <div data-slot="chart-x-axis" data-tick={tick} aria-hidden="true" className={className} style={style}>
      {/* Every horizontal label shows, so a hidden sizer gives the axis column the widest one. */}
      {context.orientation === "horizontal" ? (
        <span data-slot="chart-axis-sizer">
          {ticks.map(({ slot, text }) => (
            <span key={slot}>{text}</span>
          ))}
        </span>
      ) : null}
      {ticks.map(({ slot, text, at, visibility }) => (
        <span
          key={slot}
          data-slot="chart-x-tick"
          data-min={visibility === "always" ? undefined : String(visibility)}
          style={{ "--chart-at": at }}>
          {text}
        </span>
      ))}
      {label === undefined ? null : <span data-slot="chart-axis-label">{label}</span>}
    </div>
  );
}

/**
 * The value axis in both orientations, with d3 nice ticks. Under `stackOffset="expand"` it prints
 * shares by default. A hidden sizer holds every label, so the axis column takes the widest label's
 * width on the server and in every engine alike.
 *
 * @beta
 */
export function ChartYAxis({
  format,
  label,
  side = "start",
  className,
  style,
}: ChartYAxisProps): ReactElement {
  const context = useChartRoot("Chart.YAxis");
  const { y, keys } = usePlotLayout("Chart.YAxis");
  const first = keys[0];
  const fallback: ValueFormat =
    context.stackOffset === "expand"
      ? { style: "percent" }
      : ((first === undefined ? undefined : context.config[first]?.format) ?? {});
  const labels = y.ticks.map((value) => ({
    value,
    text: formatValue(context.locale, value, format ?? fallback, "tick").text,
  }));
  const inline = context.orientation === "horizontal" ? inlineValueTicks(labels, y.domain) : undefined;
  return (
    <div data-slot="chart-y-axis" data-side={side} aria-hidden="true" className={className} style={style}>
      <span data-slot="chart-axis-sizer">
        {labels.map(({ value, text }) => (
          <span key={value}>{text}</span>
        ))}
      </span>
      {labels.map(({ value, text }, index) => {
        const at = valueTop(y.domain, value);
        // The domain's two ends mark their ticks, so a horizontal axis keeps both labels inside it.
        const edge = at === 0 ? "end" : at === 100 ? "start" : undefined;
        const shown = inline?.[index];
        // A value label that fits no width stays out, as an x label does.
        if (shown === "none") return null;
        return (
          <span
            key={value}
            data-slot="chart-y-tick"
            data-edge={edge}
            data-min={shown === undefined || shown === "always" ? undefined : String(shown)}
            style={{ "--chart-at": `${String(at)}%` }}>
            {text}
          </span>
        );
      })}
      {label === undefined ? null : <span data-slot="chart-axis-label">{label}</span>}
    </div>
  );
}

Object.assign(ChartXAxis, { displayName: "Chart.XAxis" });
Object.assign(ChartYAxis, { displayName: "Chart.YAxis" });
