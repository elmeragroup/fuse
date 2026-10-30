"use client";

import { memo, use, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { ChartDatumContext } from "./chart-active-value";
import { attachJoin, placeAttached, pointAxes, pointCentre, restingPoint } from "./chart-attached";
import type { AttachedShown, FollowerJoin } from "./chart-attached";
import { assertKnownKey, useChartRoot } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { useChartFollower } from "./chart-followers";
import type { MarkValues, Placement } from "./chart-motion";
import { useFollowerPlacement, useMotionMark } from "./chart-motion-mark";
import { stepRole } from "./chart-paint";
import { useChartFrame } from "./chart-plot";
import { readingAt, useActivePoint } from "./chart-readout";
import { childSlot } from "./chart-reference";
import { useFirstPhase } from "./chart-store";
import type { ChartDatum, ChartLayerProps, ChartX, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import type { SeriesModel } from "./layout/cartesian-model";
import { seriesPaint } from "./layout/color-key";
import { keywordSlots, listedSlots } from "./layout/datum";
import type { PlotFrame } from "./layout/plot-frame";
import { seriesPath } from "./layout/series-path";
import { slotOf } from "./layout/x-domain";

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
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    index += 1;
  }
}

/** Draw a series' dots from the loop's numbers. */
function drawDots(group: SVGGElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame !== null) writeCentres(group.children, { frame, xScale }, values);
}

/** The series a part names, or undefined for a key the model lacks. */
function seriesOf(context: ChartRootContextValue, dataKey: string): SeriesModel | undefined {
  return context.model.series.find(({ key }) => key === dataKey);
}

/**
 * How attached point marks reach a commit's geometry: they join what they sit on, and snap when
 * nothing they sit on moves, so a dot never tweens on a route of its own.
 */
function attachedPlacement(placement: Placement, join: FollowerJoin | undefined): Placement {
  return join === undefined && placement.kind === "move" ? { kind: "snap" } : placement;
}

/** One dot, which keeps the `data-intro` value its first render chose, so an added dot fades in. */
const Dot = memo(function Dot({
  intro,
  series,
  radius,
  centre,
}: {
  readonly intro: "fade" | "none" | undefined;
  readonly series: number;
  readonly radius: number;
  readonly centre: { readonly cx: number; readonly cy: number };
}) {
  const [firstIntro] = useState(intro);
  return <circle data-slot="chart-dot" data-series={series} data-intro={firstIntro} r={radius} {...centre} />;
});

/** What an attached part writes on `data-intro` for marks that mount now. */
function useIntro(context: ChartRootContextValue): "fade" | "none" | undefined {
  const phase = useFirstPhase(context.store);
  const [first] = useState(context.update);
  if (phase === "initial" && context.update === first) return context.entrance ? undefined : "none";
  return context.update.kind === "data" ? "fade" : "none";
}

/**
 * A dot on every reading of one series, on its Line's or Area's vertices. The dots move with the
 * series' path on a data update, and a dot that an update adds fades in.
 *
 * @beta
 */
export function ChartDots({ dataKey, variant = "default", className, style }: ChartDotsProps): ReactElement {
  const context = useChartRoot("Chart.Dots");
  assertKnownKey("Chart.Dots", context.config, dataKey);
  const series = seriesOf(context, dataKey);
  const drawn = useChartFrame("Chart.Dots");
  const frame = drawn?.frame ?? null;
  const columns =
    frame === null ? undefined : frame.orientation === "vertical" ? frame.box.width : frame.box.height;
  // The dots sit on the vertices the series' path draws, decimated alike above the limit.
  const dots = useMemo(() => {
    if (series === undefined || frame === null) return [];
    const path = seriesPath(context.model, series, context.update.keys, columns);
    return path.vertices.flatMap((vertex, index) => {
      const point = vertex.state === "reading" ? restingPoint(context, frame, series, vertex.slot) : null;
      return point === null
        ? []
        : [{ key: path.keys[index] ?? String(vertex.slot), slot: vertex.slot, point }];
    });
  }, [context, series, frame, columns]);
  const look = useMemo((): PointLook => ({ frame, xScale: context.xScale }), [frame, context.xScale]);
  const {
    ref: dotsRef,
    node: dotsNode,
    drawn: dotsDrawn,
    place: placeDots,
  } = useMotionMark(context.motion, drawDots, look, pointAxes(context.orientation));
  const placeFor = useFollowerPlacement(context.update, drawn?.plot ?? null, context.orientation);
  const outgoing = useRef<SVGGElement>(null);
  const shown = useRef<AttachedShown<PointLook> | null>(null);
  useChartFollower("Chart.Dots", (_active, cause) => {
    // The dots rest on their readings, so a pointer or key step moves none of them.
    if (cause === "step" || series === undefined || frame === null) return;
    const rest = dots.flatMap(({ point }) => [...point]);
    const join = attachJoin(
      context,
      series,
      dots.map(({ slot }) => slot),
      rest,
      "line"
    );
    // The dots crossfade with their path: the old dots fade out where they were drawn.
    placeAttached({
      motion: context.motion,
      cause,
      join,
      placement: attachedPlacement(placeFor(cause, join), join),
      place: (placement) => placeDots(rest, placement),
      node: dotsNode(),
      outgoing: outgoing.current,
      before: dotsDrawn(),
      look,
      shown,
      draw: (copy, old, values) => {
        if (copy instanceof SVGGElement) drawDots(copy, old, values);
      },
    });
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
          <g ref={dotsRef}>
            {dots.map(({ key, point }) => (
              <Dot
                key={key}
                intro={intro}
                series={series?.seriesIndex ?? 0}
                radius={radius}
                centre={pointCentre(frame, context.xScale, point[0], point[1])}
              />
            ))}
          </g>
          <g ref={outgoing} data-part="outgoing" />
        </>
      )}
    </svg>
  );
}

/** The paint of a series' point marks: its role, or a role list's first role. */
function seriesPaintOf(context: ChartRootContextValue, dataKey: string): string {
  return seriesPaint(dataKey, stepRole(context.config[dataKey]?.color ?? "chart-1", undefined));
}

/** Draw the active dot at the loop's numbers, its place and its value, with its ping ring if any. */
function drawActiveDot(svg: SVGSVGElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame === null) return;
  const dots = svg.querySelectorAll(":scope > [data-slot=chart-dot]");
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
  const context = useChartRoot("Chart.ActiveDot");
  assertKnownKey("Chart.ActiveDot", context.config, dataKey);
  const series = seriesOf(context, dataKey);
  const drawn = useChartFrame("Chart.ActiveDot");
  const frame = drawn?.frame ?? null;
  const look = useMemo((): PointLook => ({ frame, xScale: context.xScale }), [frame, context.xScale]);
  const {
    ref: dotRef,
    node: dotNode,
    drawn: dotDrawn,
    place: placeDot,
  } = useMotionMark(context.motion, drawActiveDot, look, pointAxes(context.orientation));
  const placeFor = useFollowerPlacement(context.update, drawn?.plot ?? null, context.orientation);
  const outgoing = useRef<HTMLDivElement>(null);
  const shown = useRef<AttachedShown<PointLook> | null>(null);
  useChartFollower("Chart.ActiveDot", (active, cause) => {
    const point =
      active === null || series === undefined || frame === null
        ? null
        : restingPoint(context, frame, series, active.slot);
    const join =
      active === null || series === undefined || point === null
        ? undefined
        : attachJoin(context, series, [active.slot], [...point], "line");
    const placement = attachedPlacement(placeFor(cause, join), join);
    const svg = dotNode();
    if (svg === null) return;
    // The dot shows only while the series draws a reading at the active slot.
    if (point === null) {
      svg.removeAttribute("data-value");
      return;
    }
    svg.setAttribute("data-value", "");
    // The dot crossfades with its path while it shows at the active slot.
    placeAttached({
      motion: context.motion,
      cause,
      join,
      placement,
      place: (next) => placeDot([point[0], point[1]], next),
      node: svg,
      outgoing: outgoing.current,
      before: dotDrawn(),
      look,
      shown,
      draw: (copy, old, values) => {
        if (copy instanceof SVGSVGElement) drawActiveDot(copy, old, values);
      },
    });
  });
  const radius = DOT_RADIUS[variant];
  // The old dot fades out beside the live one, so the live dot's fade-in never reaches it.
  return (
    <>
      <svg
        ref={dotRef}
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
      <div ref={outgoing} data-part="outgoing" />
    </>
  );
}

/** Whether a datum names x values rather than a keyword. */
function isListed(at: ChartDatum): at is { readonly x: ChartX | readonly ChartX[] } {
  return at !== "first" && at !== "last" && at !== "min" && at !== "max" && at !== "now";
}

/** The slots a Marker's `at` selects, comparing the series' readings. */
function markerSlots(
  context: ChartRootContextValue,
  series: SeriesModel | undefined,
  at: ChartDatum
): number[] {
  const { model } = context;
  if (series === undefined || model.window === null) return [];
  if (isListed(at)) {
    const xs: readonly ChartX[] = Array.isArray(at.x) ? at.x : [at.x];
    return listedSlots(
      xs.map((x) => childSlot(context, "Chart.Marker", x)),
      model.window
    );
  }
  const nowSlot =
    context.now === undefined || model.domain.kind !== "time" ? -1 : slotOf(model.domain, context.now);
  const values = series.readings.map((reading) => (reading.kind === "reading" ? reading.value : null));
  // A marker sits on a reading, so "now" picks the now slot only where the series has one.
  return keywordSlots(at, { values, window: model.window, nowSlot }).filter(
    (slot) => series.readings[slot]?.kind === "reading"
  );
}

/** Draw a Marker's dots and its pills' anchors from the loop's numbers, a place and a value per slot. */
function drawMarker(box: HTMLDivElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame === null) return;
  const svg = box.querySelector(":scope > svg");
  if (svg !== null) {
    const dots = [...svg.children].filter((child) => child.getAttribute("data-slot") === "chart-dot");
    writeCentres(dots, { frame, xScale }, values, dots.length / Math.max(1, values.length / 2));
  }
  let index = 0;
  for (const anchor of box.querySelectorAll<HTMLElement>(":scope > [data-part=anchor]")) {
    const { cx, cy } = pointCentre(frame, xScale, values[index * 2] ?? 0, values[index * 2 + 1] ?? 0);
    anchor.style.setProperty("--chart-marker-x", `${String(cx)}px`);
    anchor.style.setProperty("--chart-marker-y", `${String(cy)}px`);
    index += 1;
  }
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
  const context = useChartRoot("Chart.Marker");
  assertKnownKey("Chart.Marker", context.config, dataKey);
  const series = seriesOf(context, dataKey);
  const drawn = useChartFrame("Chart.Marker");
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
    [context, series, frame, slotsKey] // oxlint-disable-line react-hooks/exhaustive-deps -- the joined slots are the identity
  );
  const look = useMemo((): PointLook => ({ frame, xScale: context.xScale }), [frame, context.xScale]);
  const {
    ref: markerRef,
    node: markerNode,
    drawn: markerDrawn,
    place: placeMarker,
  } = useMotionMark(context.motion, drawMarker, look, pointAxes(context.orientation));
  const placeFor = useFollowerPlacement(context.update, drawn?.plot ?? null, context.orientation);
  const outgoing = useRef<HTMLDivElement>(null);
  const shown = useRef<AttachedShown<PointLook> | null>(null);
  useChartFollower("Chart.Marker", (_active, cause) => {
    if (cause === "step" || series === undefined || frame === null) return;
    const rest = marked.flatMap(({ point }) => [...point]);
    const join = attachJoin(
      context,
      series,
      marked.map(({ slot }) => slot),
      rest,
      "line"
    );
    // The marker and its pills crossfade with their path, the pills' old text included.
    placeAttached({
      motion: context.motion,
      cause,
      join,
      placement: attachedPlacement(placeFor(cause, join), join),
      place: (placement) => placeMarker(rest, placement),
      node: markerNode(),
      outgoing: outgoing.current,
      before: markerDrawn(),
      look,
      shown,
      draw: (copy, old, values) => {
        if (copy instanceof HTMLDivElement) drawMarker(copy, old, values);
      },
    });
  });
  const intro = useIntro(context);
  const radius = DOT_RADIUS[variant];
  const seriesIndex = series?.seriesIndex ?? 0;
  // The old marker fades out beside the live one, so the live marker's fade-in never reaches it.
  return (
    <>
      <div
        ref={markerRef}
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
                const centre = pointCentre(frame, context.xScale, point[0], point[1]);
                const dot = (
                  <Dot
                    key={`${String(slot)}-dot`}
                    intro={intro}
                    series={seriesIndex}
                    radius={radius}
                    centre={centre}
                  />
                );
                return variant === "ping"
                  ? [
                      <circle
                        key={`${String(slot)}-ping`}
                        data-slot="chart-dot"
                        data-part="ping"
                        r={radius}
                        {...centre}
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
      <div ref={outgoing} data-part="outgoing" />
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
