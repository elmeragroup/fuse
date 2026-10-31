"use client";

import { memo, use, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { ChartDatumContext } from "./chart-active-value";
import { attachJoin, pointAxes, pointCentre, restingPoint, useAttachedMark } from "./chart-attached";
import type { AttachedCopy } from "./chart-attached";
import { useChartRoot, useSeriesPart } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { datumSlots } from "./chart-datum";
import { partsCache, writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { MarkValues, ValueAxis } from "./chart-motion";
import { stepRole } from "./chart-paint";
import { useChartFrame } from "./chart-plot";
import { readingAt, useActivePoint } from "./chart-readout";
import { introFor, useFirstPhase } from "./chart-store";
import type { ChartDatum, ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import type { SeriesModel } from "./layout/cartesian-model";
import { seriesPaint } from "./layout/color-key";
import type { PlotFrame } from "./layout/plot-frame";
import { seriesOf } from "./layout/series-of";
import { seriesPathOf } from "./layout/series-path";

/**
 * Props for `Chart.Dots`, a closed part.
 *
 * @beta
 */
export type ChartDotsProps = ChartLayerProps & {
  /** The series whose readings get a dot. */
  dataKey: string;
  /**
   * The dot's look. "default" by default, a filled dot inside a ring of the surface. "ring" is a
   * hollow ring and "halo" a dot inside a faint halo of its colour.
   */
  variant?: "default" | "ring" | "halo";
};

/**
 * Props for `Chart.ActiveDot`, a closed part.
 *
 * @beta
 */
export type ChartActiveDotProps = ChartLayerProps & {
  /** The series the dot follows. */
  dataKey: string;
  /** The dot's look. "default" by default. "ping" sends a ring out from the dot once a second. */
  variant?: "default" | "ring" | "halo" | "ping";
};

/**
 * Props for `Chart.Marker`, a closed part.
 *
 * @beta
 */
export type ChartMarkerProps = ChartLayerProps & {
  /** The series the marker sits on. */
  dataKey: string;
  /** The slots to mark. An x string on a time axis throws `x-type-mismatch`. */
  at: ChartDatum;
  /** The dot's look. "default" by default. */
  variant?: "default" | "ring" | "halo" | "ping";
  /** A `ValueLabel` adds the value as a pill beside the dot. */
  children?: ReactNode;
};

/**
 * Props for `Chart.ValueLabel`, a closed part.
 *
 * @beta
 */
export type ChartValueLabelProps = ChartLayerProps & {
  /** The value format. The series' config `format` is the default. */
  format?: ValueFormat;
};

/** The radius of each dot look, in CSS pixels, so a dot reads 8 px across or more. */
const DOT_RADIUS = { default: 4, ring: 4, halo: 5, ping: 4 } as const;

/** What a point mark's writer reads: the frame it draws in, or null before Root measures it. */
type PointLook = { readonly frame: PlotFrame | null; readonly xScale: "band" | "point" };

/**
 * Write each dot's centre from the loop's numbers, a place and a value per point, in order. A point
 * may draw more than one circle, as a ping ring and its dot do, which share its numbers.
 */
function writeCentres(
  dots: Iterable<Element>,
  look: { readonly frame: PlotFrame; readonly xScale: "band" | "point" },
  values: MarkValues,
  perPoint = 1
): void {
  const { frame, xScale } = look;
  let index = 0;
  for (const dot of dots) {
    const point = Math.floor(index / perPoint);
    const { cx, cy } = pointCentre(frame, xScale, values[point * 2] ?? 0, values[point * 2 + 1] ?? 0);
    writeAttribute(dot, "cx", cx);
    writeAttribute(dot, "cy", cy);
    index += 1;
  }
}

/** Draw a series' dots from the loop's numbers. */
function drawDots(group: SVGGElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame !== null) writeCentres(group.children, { frame, xScale }, values);
}

/**
 * One dot, which keeps the `data-intro` value and the centre its first render chose, so an added
 * dot fades in and React writes its centre once. The loop draws the centre after that.
 */
const Dot = memo(function Dot({
  intro,
  series,
  radius,
  cx,
  cy,
}: {
  readonly intro: "fade" | "none" | undefined;
  readonly series: number;
  readonly radius: number;
  readonly cx: number;
  readonly cy: number;
}) {
  const [first] = useState({ intro, cx, cy });
  return (
    <circle
      data-slot="chart-dot"
      data-series={series}
      data-intro={first.intro}
      r={radius}
      cx={first.cx}
      cy={first.cy}
    />
  );
});

/** What an attached part writes on `data-intro` for marks that mount now. */
function useIntro(context: ChartRootContextValue): "fade" | "none" | undefined {
  const phase = useFirstPhase(context.store);
  const [first] = useState(context.update);
  return introFor(context.update === first ? phase : "mounted", context.update.kind, context.entrance);
}

/**
 * How Dots keep their last drawing: the group and one dot of it as a template, so a commit copies
 * two elements and not every dot. A crossfade then builds the old dots from the template, one per
 * point the loop drew last.
 */
const DOTS_COPY: AttachedCopy = {
  cadence: "commit",
  keep: (live) => {
    const kept = live.cloneNode(false);
    const template = live.firstElementChild?.cloneNode(false);
    if (!(kept instanceof Element)) return live;
    if (template instanceof Element) {
      // An old dot fades out, so it never runs a fade-in of its own.
      template.removeAttribute("data-intro");
      kept.append(template);
    }
    return kept;
  },
  outgoing: (kept, before) => {
    const template = kept.firstElementChild;
    const copy = kept.cloneNode(false);
    if (template === null || !(copy instanceof Element)) return null;
    for (let point = 0; point < before.length / 2; point += 1) copy.append(template.cloneNode(false));
    return copy;
  },
};

/**
 * A dot on every reading of one series, on its Line's or Area's vertices. The dots move with the
 * series' path on a data update, and a dot that an update adds fades in.
 *
 * @beta
 */
export function ChartDots({ dataKey, variant = "default", className, style }: ChartDotsProps): ReactElement {
  const { context, layout } = useSeriesPart("Chart.Dots", dataKey);
  const { model, update } = context;
  const series = seriesOf(model, dataKey);
  const drawn = useChartFrame("Chart.Dots", layout);
  const frame = drawn?.frame ?? null;
  const columns =
    frame === null ? undefined : frame.orientation === "vertical" ? frame.box.width : frame.box.height;
  // The dots sit on the vertices the series' path draws, the Line's own path, decimated alike.
  const dots = useMemo(() => {
    if (series === undefined || frame === null) return [];
    const path = seriesPathOf(model, series, update.keys, columns);
    return path.vertices.flatMap((vertex, index) => {
      const point = vertex.state === "reading" ? restingPoint(context, frame, series, vertex.slot) : null;
      return point === null
        ? []
        : [{ key: path.keys[index] ?? String(vertex.slot), slot: vertex.slot, point }];
    });
  }, [model, update.keys, series, frame, columns]); // oxlint-disable-line react-hooks/exhaustive-deps -- restingPoint reads the model and the x scale alone
  const rest = useMemo(() => dots.flatMap(({ point }) => [...point]), [dots]);
  const slots = useMemo(() => dots.map(({ slot }) => slot), [dots]);
  const look = useMemo((): PointLook => ({ frame, xScale: context.xScale }), [frame, context.xScale]);
  const {
    ref: markRef,
    outgoingRef,
    attach,
  } = useAttachedMark<SVGGElement, PointLook, ValueAxis[], SVGGElement>(
    context,
    drawn,
    drawDots,
    look,
    pointAxes(context.orientation),
    { point: true, copy: DOTS_COPY }
  );
  useChartFollower("Chart.Dots", (_active, cause) => {
    // The dots rest on their readings, so a pointer or key step moves none of them.
    if (cause === "step" || series === undefined || frame === null) return;
    // The dots crossfade with their path: the old dots fade out where they were drawn.
    attach(cause, () => attachJoin(context, series, slots, rest, "line"), rest);
  });
  const intro = useIntro(context);
  // The layer keeps the intro of its first render, which Root's entrance wipe reads.
  const [layerIntro] = useState(intro);
  const radius = DOT_RADIUS[variant];
  return (
    <svg
      data-slot="chart-dots"
      data-variant={variant}
      data-series={series?.seriesIndex}
      data-intro={layerIntro}
      aria-hidden="true"
      className={className}
      style={{
        "--chart-series-paint": seriesPaintOf(context, dataKey),
        "--chart-series": series?.seriesIndex,
        ...style,
      }}>
      {frame === null ? null : (
        <>
          <g ref={markRef}>
            {dots.map(({ key, point }) => {
              const { cx, cy } = pointCentre(frame, context.xScale, point[0], point[1]);
              return (
                <Dot
                  key={key}
                  intro={intro}
                  series={series?.seriesIndex ?? 0}
                  radius={radius}
                  cx={cx}
                  cy={cy}
                />
              );
            })}
          </g>
          <g ref={outgoingRef} data-part="outgoing" />
        </>
      )}
    </svg>
  );
}

/** The paint of a series' point marks: its role, or a role list's first role. */
function seriesPaintOf(context: ChartRootContextValue, dataKey: string): string {
  return seriesPaint(dataKey, stepRole(context.config[dataKey]?.color ?? "chart-1", undefined));
}

/** The active dot's circles, its ping ring first if any, found once per node and look. */
const activeDots = partsCache((svg) => [...svg.querySelectorAll(":scope > [data-slot=chart-dot]")]);

/** Draw the active dot at the loop's numbers, its place and its value, with its ping ring if any. */
function drawActiveDot(svg: SVGSVGElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame === null) return;
  const dots = activeDots(svg, look);
  writeCentres(dots, { frame, xScale }, values, dots.length);
}

/**
 * The dot on one series at the active slot. Write one per series that needs one. Root moves it
 * with the pointer and keys at once, and during a data update it rides its series' vertex.
 *
 * @beta
 */
export function ChartActiveDot({
  dataKey,
  variant = "default",
  className,
  style,
}: ChartActiveDotProps): ReactElement {
  const { context, layout } = useSeriesPart("Chart.ActiveDot", dataKey);
  const series = seriesOf(context.model, dataKey);
  const drawn = useChartFrame("Chart.ActiveDot", layout);
  const frame = drawn?.frame ?? null;
  const look = useMemo((): PointLook => ({ frame, xScale: context.xScale }), [frame, context.xScale]);
  const {
    ref: markRef,
    node: markNode,
    outgoingRef,
    attach,
  } = useAttachedMark(context, drawn, drawActiveDot, look, pointAxes(context.orientation), {
    point: true,
  });
  useChartFollower("Chart.ActiveDot", (active, cause) => {
    const point =
      active === null || series === undefined || frame === null
        ? null
        : restingPoint(context, frame, series, active.slot);
    const svg = markNode();
    // The dot shows only while the series draws a reading at the active slot.
    if (svg !== null) writeAttribute(svg, "data-value", point === null ? null : "");
    // The dot crossfades with its path while it shows at the active slot.
    attach(
      cause,
      () =>
        active === null || series === undefined || point === null
          ? undefined
          : attachJoin(context, series, [active.slot], [...point], "line"),
      svg === null ? null : point
    );
  });
  const radius = DOT_RADIUS[variant];
  // The old dot fades out beside the live one, so the live dot's fade-in never reaches it.
  return (
    <>
      <svg
        ref={markRef}
        data-slot="chart-active-dot"
        data-variant={variant}
        data-series={series?.seriesIndex}
        data-follow=""
        aria-hidden="true"
        className={className}
        style={{
          "--chart-series-paint": seriesPaintOf(context, dataKey),
          // The ordinal the dimming rules compare with the selected or highlighted series.
          "--chart-series": series?.seriesIndex,
          ...style,
        }}>
        {frame === null ? null : (
          <>
            {variant === "ping" ? <circle data-slot="chart-dot" data-part="ping" r={radius} /> : null}
            <circle data-slot="chart-dot" data-series={series?.seriesIndex} r={radius} />
          </>
        )}
      </svg>
      <div ref={outgoingRef} data-part="outgoing" />
    </>
  );
}

/** The slots a Marker's `at` selects, comparing the series' readings, where the series has one. */
function markerSlots(
  context: ChartRootContextValue,
  series: SeriesModel | undefined,
  at: ChartDatum
): number[] {
  if (series === undefined) return [];
  const values = series.readings.map((reading) => (reading.kind === "reading" ? reading.value : null));
  // A marker sits on a reading, so "now" or an x picks a slot only where the series has one.
  return datumSlots(context, "Chart.Marker", series, at, values).filter(
    (slot) => series.readings[slot]?.kind === "reading"
  );
}

/** A Marker's dots and its pills' anchors, found once per node and look. */
const markerParts = partsCache((box) => ({
  dots: [...(box.querySelector(":scope > svg")?.children ?? [])].filter(
    (child) => child.getAttribute("data-slot") === "chart-dot"
  ),
  anchors: [...box.querySelectorAll<HTMLElement>(":scope > [data-part=anchor]")],
}));

/** Draw a Marker's dots and its pills' anchors from the loop's numbers, a place and a value per slot. */
function drawMarker(box: HTMLDivElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame === null) return;
  const { dots, anchors } = markerParts(box, look);
  writeCentres(dots, { frame, xScale }, values, dots.length / Math.max(1, values.length / 2));
  anchors.forEach((anchor, index) => {
    const { cx, cy } = pointCentre(frame, xScale, values[index * 2] ?? 0, values[index * 2 + 1] ?? 0);
    writeStyle(anchor, "--chart-marker-x", `${String(cx)}px`);
    writeStyle(anchor, "--chart-marker-y", `${String(cy)}px`);
  });
}

/**
 * A resting dot on one series at the slots `at` selects, such as the current slot, the latest
 * reading or the minimum, as the Figma price chart's Now indicator draws. A `ValueLabel` child adds
 * the value as a pill above each dot, or beside it for `at="min"`, so it never covers the line
 * that rises on both sides of the lowest reading. It sits on a Line's or an Area's vertex, or at a Bar's tip,
 * and moves with what it sits on during a data update. It is plot output that readers skip, and
 * the option and description carry its meaning.
 *
 * @beta
 */
export function ChartMarker({
  dataKey,
  at,
  variant = "default",
  className,
  style,
  children,
}: ChartMarkerProps): ReactElement {
  const { context, layout } = useSeriesPart("Chart.Marker", dataKey);
  const series = seriesOf(context.model, dataKey);
  const drawn = useChartFrame("Chart.Marker", layout);
  const frame = drawn?.frame ?? null;
  const slots = markerSlots(context, series, at);
  const slotsKey = slots.join(",");
  const marked = useMemo(
    () =>
      series === undefined || frame === null
        ? []
        : slots.flatMap((slot) => {
            const point = restingPoint(context, frame, series, slot);
            return point === null ? [] : [{ slot, point }];
          }),
    [context.model, context.xScale, series, frame, slotsKey] // oxlint-disable-line react-hooks/exhaustive-deps -- the joined slots are the identity, and restingPoint reads the model and the x scale alone
  );
  const look = useMemo((): PointLook => ({ frame, xScale: context.xScale }), [frame, context.xScale]);
  const {
    ref: markRef,
    outgoingRef,
    attach,
  } = useAttachedMark(context, drawn, drawMarker, look, pointAxes(context.orientation), {
    point: true,
  });
  useChartFollower("Chart.Marker", (_active, cause) => {
    if (cause === "step" || series === undefined || frame === null) return;
    const rest = marked.flatMap(({ point }) => [...point]);
    // The marker and its pills crossfade with their path, the pills' old text included.
    attach(
      cause,
      () =>
        attachJoin(
          context,
          series,
          marked.map(({ slot }) => slot),
          rest,
          "line"
        ),
      rest
    );
  });
  const intro = useIntro(context);
  const radius = DOT_RADIUS[variant];
  const seriesIndex = series?.seriesIndex ?? 0;
  // The old marker fades out beside the live one, so the live marker's fade-in never reaches it.
  return (
    <>
      <div
        ref={markRef}
        data-slot="chart-marker"
        data-variant={variant}
        data-series={series?.seriesIndex}
        aria-hidden="true"
        className={className}
        style={{
          "--chart-series-paint": seriesPaintOf(context, dataKey),
          // The ordinal the dimming rules compare with the selected or highlighted series.
          "--chart-series": series?.seriesIndex,
          ...style,
        }}>
        {frame === null ? null : (
          <>
            <svg aria-hidden="true">
              {marked.flatMap(({ slot, point }) => {
                const { cx, cy } = pointCentre(frame, context.xScale, point[0], point[1]);
                const dot = (
                  <Dot
                    key={`${String(slot)}-dot`}
                    intro={intro}
                    series={seriesIndex}
                    radius={radius}
                    cx={cx}
                    cy={cy}
                  />
                );
                return variant === "ping"
                  ? [
                      <circle
                        key={`${String(slot)}-ping`}
                        data-slot="chart-dot"
                        data-part="ping"
                        r={radius}
                        cx={cx}
                        cy={cy}
                      />,
                      dot,
                    ]
                  : [dot];
              })}
            </svg>
            {marked.map(({ slot, point }) => {
              const { cx, cy } = pointCentre(frame, context.xScale, point[0], point[1]);
              return (
                <span
                  key={slot}
                  data-part="anchor"
                  data-side={at === "min" ? "beside" : undefined}
                  style={{ "--chart-marker-x": `${String(cx)}px`, "--chart-marker-y": `${String(cy)}px` }}>
                  <ChartDatumContext value={{ key: dataKey, slot }}>{children}</ChartDatumContext>
                </span>
              );
            })}
          </>
        )}
      </div>
      <div ref={outgoingRef} data-part="outgoing" />
    </>
  );
}

/**
 * The value of the enclosing Marker's or ActiveValueLine's datum, as a pill. It is plot output that
 * readers skip, because the option carries the value.
 *
 * @beta
 */
export function ChartValueLabel({ format, className, style }: ChartValueLabelProps): ReactElement {
  const context = useChartRoot("Chart.ValueLabel");
  const datum = use(ChartDatumContext);
  const point = useActivePoint(context, datum?.slot === null);
  const slot = datum?.slot ?? point.slot;
  const reading = datum === null || slot === null ? undefined : readingAt(context, datum.key, slot);
  const text =
    datum !== null && reading?.kind === "reading"
      ? formatValue(context.locale, reading.value, format ?? context.config[datum.key]?.format ?? {}, "tick")
          .text
      : null;
  return (
    <span data-slot="chart-value-label" aria-hidden="true" className={className} style={style}>
      {text}
    </span>
  );
}

Object.assign(ChartDots, { displayName: "Chart.Dots" });
Object.assign(ChartActiveDot, { displayName: "Chart.ActiveDot" });
Object.assign(ChartMarker, { displayName: "Chart.Marker" });
Object.assign(ChartValueLabel, { displayName: "Chart.ValueLabel" });
