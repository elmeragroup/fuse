"use client";

import { memo, use, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { ChartDatumContext } from "./chart-active-value";
import {
  attachJoin,
  followedKind,
  noteShownText,
  pointAxes,
  pointCentre,
  restingPoint,
  useAttachedMark,
} from "./chart-attached";
import type { AttachedCopy } from "./chart-attached";
import { barAnchor } from "./chart-bar-draw";
import { useChartRoot, useSeriesPart } from "./chart-context";
import type { ChartRootContextValue } from "./chart-context";
import { datumSlots } from "./chart-datum";
import { partsCache, writeAttribute, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { MarkValues, ValueAxis } from "./chart-motion";
import { seriesPaintOf } from "./chart-paint";
import { pathAnchor, routeRestIndex } from "./chart-paths";
import { useChartFrame } from "./chart-plot";
import { readingAt, useActiveSlot } from "./chart-readout";
import { glideShown, rideFrom, snapGlide, stepSpring } from "./chart-spring";
import type { Ride } from "./chart-spring";
import { useSteady } from "./chart-steady";
import { introFor, useKeptIntro, usePhase } from "./chart-store";
import type { ChartDatum, ChartLayerProps, ValueFormat } from "./chart-types";
import { formatValue } from "./format/value-format";
import { barCellAt, barCells } from "./layout/bar-geometry";
import type { SeriesModel } from "./layout/cartesian-model";
import { ownSlot } from "./layout/coarse-slots";
import { alongLength } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";
import { parseTrack, rideCourse, rideKeyframes, runBetween, trackOf } from "./layout/ride";
import type { Track } from "./layout/ride";
import { sameItems } from "./layout/same-items";
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
 * dot fades in and React writes its centre once. The loop draws the centre after that, so the dot
 * renders again only for the props it reads after its first render.
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
}, sameDot);

/** Whether a dot's later props change what it renders: its series and its radius. */
function sameDot(
  a: { readonly series: number; readonly radius: number },
  b: { readonly series: number; readonly radius: number }
): boolean {
  return a.series === b.series && a.radius === b.radius;
}

/**
 * What an attached part writes on `data-intro` for the dots that mount now, which draw as they
 * mount: nothing while Root's entrance waits, so they join it, and their update's intro after it
 * started.
 */
function useMountIntro(context: ChartRootContextValue): "fade" | "none" | undefined {
  return introFor(usePhase(context.store), context.update.kind, context.entrance);
}

/**
 * How Dots keep their last drawing: the group and one dot of it as a template, so a commit copies
 * two elements and not every dot. A crossfade then builds the old dots from the template, one per
 * point the loop drew last.
 */
const DOTS_COPY: AttachedCopy = {
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
  const { model, update, xScale } = context;
  const { window } = model;
  const series = seriesOf(model, dataKey);
  const drawn = useChartFrame("Chart.Dots", layout);
  const frame = drawn?.frame ?? null;
  // The dots sit on the vertices the series' path draws, the Line's own path, decimated alike.
  const dots = useMemo(() => {
    if (series === undefined || frame === null) return [];
    const path = seriesPathOf(model, series, update.keys, alongLength(frame));
    const place = { window, xScale };
    return path.vertices.flatMap((vertex, index) => {
      const point = vertex.state === "reading" ? restingPoint(place, frame, series, vertex.slot) : null;
      return point === null
        ? []
        : [{ key: path.keys[index] ?? String(vertex.slot), slot: vertex.slot, point }];
    });
  }, [model, update.keys, series, frame, window, xScale]);
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
    attach(cause, attachJoin(context, series, slots, rest, "line"), rest);
  });
  const intro = useMountIntro(context);
  // The layer renders on the server, before it draws, and Root's entrance wipe reads its intro.
  const layerIntro = useKeptIntro(intro, frame !== null);
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
        "--chart-series-paint": pointPaint(context, dataKey, series),
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
function pointPaint(
  context: ChartRootContextValue,
  dataKey: string,
  series: SeriesModel | undefined
): string {
  return seriesPaintOf(dataKey, context.config[dataKey]?.color ?? "chart-1", series).base;
}

/** The active dot's circles, its ping ring first if any, found once per commit of its mark. */
const activeDots = partsCache((svg) => [...svg.querySelectorAll(":scope > [data-slot=chart-dot]")]);

/** Draw the active dot at the loop's numbers, its place and its value, with its ping ring if any. */
function drawActiveDot(svg: SVGSVGElement, look: PointLook, values: MarkValues): void {
  const { frame, xScale } = look;
  if (frame === null) return;
  const dots = activeDots(svg);
  writeCentres(dots, { frame, xScale }, values, dots.length);
}

/** A dot's centre in its layer's pixels. */
type Centre = { readonly cx: number; readonly cy: number };

/**
 * The track an active dot last rode and what it was read from: a line's path data, or the series,
 * the loop's resting revision and the frame its bars rest in.
 */
type KeptTrack =
  | { readonly kind: "line"; readonly data: string; readonly track: Track }
  | {
      readonly kind: "bars";
      readonly series: string;
      readonly revision: number;
      readonly frame: PlotFrame;
      readonly track: Track;
    };

/**
 * Where an active dot on a Bar series rests at a slot, as attaching places it: the middle of its
 * bar's far end, the tip of a positive bar or a stack's segment and the low end of a negative one,
 * as the bar rests in the loop. In the path form, the columns' resting place and value at the
 * slot, in the series' own sub-band, or the series' resting point where the columns draw no entry
 * of their own for it.
 */
function barEnd(
  context: ChartRootContextValue,
  series: SeriesModel,
  frame: PlotFrame,
  slot: number,
  kind: "columns" | "bars"
): Centre | null {
  const cell = barCellAt(context.model, series, slot);
  if (cell === null) return null;
  const point = kind === "bars" ? barTipAt(context, series, cell.slot) : columnAt(context, series, cell.slot);
  const resting =
    point ?? restingPoint({ window: context.model.window, xScale: context.xScale }, frame, series, slot);
  return resting === null ? null : pointCentre(frame, context.xScale, resting[0], resting[1]);
}

/** A bar's middle along the slot axis and its tip, where it rests in the loop, or null. */
function barTipAt(
  context: ChartRootContextValue,
  series: SeriesModel,
  slot: number
): readonly [number, number] | null {
  const rest = context.motion.restAt(barAnchor(series.seriesIndex, slot));
  return rest === null ? null : [((rest[0] ?? 0) + (rest[1] ?? 0)) / 2, rest[3] ?? 0];
}

/** The path form's columns' resting place and value at a slot, or null where they rest on none. */
function columnAt(
  context: ChartRootContextValue,
  series: SeriesModel,
  slot: number
): readonly [number, number] | null {
  const route = context.paths.get(series.seriesIndex, "columns");
  const values = context.motion.restAt(pathAnchor(series.seriesIndex, "columns"));
  if (route === undefined || values === null) return null;
  const index = routeRestIndex(route, context.update.keys[slot] ?? String(slot));
  return index === undefined
    ? null
    : [values[index * route.stride] ?? 0, values[index * route.stride + 1] ?? 0];
}

/**
 * The straight track through a Bar series' far ends, one run per stretch of bars without a
 * missing reading between them.
 */
function barTrack(
  context: ChartRootContextValue,
  series: SeriesModel,
  frame: PlotFrame,
  kind: "columns" | "bars"
): Track {
  const runs: [number, number][][] = [];
  let next: number | null = null;
  for (const cell of barCells(context.model, series)) {
    const end = barEnd(context, series, frame, cell.slot, kind);
    if (end === null) continue;
    if (cell.slot !== next || runs.length === 0) runs.push([]);
    runs.at(-1)?.push([end.cx, end.cy]);
    next = ownSlot(series, cell.slot)[1] + 1;
  }
  return trackOf(runs, context.orientation);
}

/**
 * The track an active dot rides: its series' drawn line, parsed once for each path data its writer
 * draws, or the straight track through its bars' far ends, built once for each model and frame.
 * It is null for a series with neither.
 */
function trackFor(
  context: ChartRootContextValue,
  series: SeriesModel,
  frame: PlotFrame,
  kept: { current: KeptTrack | null }
): Track | null {
  const known = kept.current;
  // The dot rides the drawing it joins, in attachJoin's order: a Line, an Area, then the bars.
  const kind = followedKind(context, series, "line");
  if (kind === "line" || kind === "area") {
    const data = context.paths.line(series.seriesIndex, kind) ?? "";
    if (data === "") return null;
    if (known?.kind === "line" && known.data === data) return known.track;
    const made: KeptTrack = { kind: "line", data, track: parseTrack(data, context.orientation) };
    kept.current = made;
    return made.track;
  }
  return keptBarTrack(context, series, frame, kept);
}

/**
 * The straight track through a Bar series' far ends that an active dot rides, built again whenever
 * the series, the frame or a bar's resting place changes, or null for a series a Line or an Area
 * draws, or no Bar.
 */
function keptBarTrack(
  context: ChartRootContextValue,
  series: SeriesModel,
  frame: PlotFrame,
  kept: { current: KeptTrack | null }
): Track | null {
  const kind = followedKind(context, series, "line");
  if (kind !== "columns" && kind !== "bars") return null;
  const known = kept.current;
  const revision = context.motion.restRevision();
  if (
    known?.kind === "bars" &&
    known.series === series.key &&
    known.revision === revision &&
    known.frame === frame
  ) {
    return known.track;
  }
  const made: KeptTrack = {
    kind: "bars",
    series: series.key,
    revision,
    frame,
    track: barTrack(context, series, frame, kind),
  };
  kept.current = made;
  return made.track;
}

/**
 * How an active dot rides its track from where it shows to where it rests: the step along the slot
 * axis, and the course across at each offset along it, which `rideCourse` reads off the track. It
 * is null, and the dot moves at once, where no run of the track spans the whole step: over a gap or
 * past a lone reading.
 */
function rideOf(
  layer: Element,
  track: Track,
  from: Centre,
  to: Centre,
  orientation: "vertical" | "horizontal"
): { readonly by: number; readonly ride: Ride } | null {
  const vertical = orientation === "vertical";
  const along = (centre: Centre) => (vertical ? centre.cx : centre.cy);
  const across = (centre: Centre) => (vertical ? centre.cy : centre.cx);
  // Where the dot shows now, a running glide's offset included.
  const shown = glideShown(layer) ?? [0, 0];
  const start = {
    along: along(from) + (vertical ? shown[0] : shown[1]),
    across: across(from) + (vertical ? shown[1] : shown[0]),
  };
  const rest = { along: along(to), across: across(to) };
  const run = runBetween(track, start, rest);
  if (run === null) return null;
  const course = rideCourse(run, start, rest);
  return {
    by: along(from) - along(to),
    ride: { axis: vertical ? "x" : "y", keyframes: (offset, peak) => rideKeyframes(offset, course, peak) },
  };
}

/**
 * The dot on one series at the active slot. Write one per series that needs one. A pointer, key or
 * touch step glides it to the next reading along its series' drawn line, in step with the crosshair
 * on a spring that quickens with the pointer, unless the reader prefers reduced motion. It rides its
 * Line's or Area's drawn line, or on a Bar series a straight track through the bars' far ends: a
 * bar's top, a stack segment's outer edge, a negative bar's low end. It moves at once across a gap
 * or a missing reading. It shows and hides at once, and during a data update it rides what it sits
 * on.
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
    drawn: drawnPoint,
  } = useAttachedMark(context, drawn, drawActiveDot, look, pointAxes(context.orientation), {
    point: true,
  });
  // Whether the dot showed at a reading after its last paint, so the next step glides from it.
  const shownBefore = useRef(false);
  // The track the dot rode last, read again when its line or its bars change.
  const track = useRef<KeptTrack | null>(null);
  useChartFollower("Chart.ActiveDot", (active, cause) => {
    const point =
      active === null || series === undefined || frame === null
        ? null
        : restingPoint({ window: context.model.window, xScale: context.xScale }, frame, series, active.slot);
    const svg = markNode();
    // Where the dot showed before this paint, as the loop last drew it, a data update's tween
    // included, or null when it showed nowhere.
    const before = drawnPoint();
    const from =
      shownBefore.current && before !== null && frame !== null
        ? pointCentre(frame, context.xScale, before[0] ?? 0, before[1] ?? 0)
        : null;
    // The dot shows only while the series draws a reading at the active slot.
    if (svg !== null) writeAttribute(svg, "data-value", point === null ? null : "");
    // The dot crossfades with its path while it shows at the active slot.
    attach(
      cause,
      active === null || series === undefined || point === null
        ? undefined
        : attachJoin(context, series, [active.slot], [...point], "line"),
      svg === null ? null : point
    );
    shownBefore.current = point !== null;
    if (svg === null) return;
    // The dot rests where what it joins placed it: on a line's vertex, or where a decimated line
    // passes its slot, or on its bar's far end.
    const placed = point === null ? null : drawnPoint();
    const to =
      placed === null || frame === null
        ? null
        : pointCentre(frame, context.xScale, placed[0] ?? 0, placed[1] ?? 0);
    // Only a step from one reading to another glides, and not while a data update moves the dot
    // with what it sits on. Showing, hiding, a commit and reduced motion place it at once.
    const { motion, orientation, store } = context;
    const steps =
      cause === "step" && series !== undefined && frame !== null && !motion.snaps() && !motion.running();
    const riding = steps && from !== null && to !== null ? trackFor(context, series, frame, track) : null;
    const ride =
      riding === null || from === null || to === null ? null : rideOf(svg, riding, from, to, orientation);
    if (ride === null) snapGlide(svg);
    else rideFrom(svg, ride.by, stepSpring(store), ride.ride);
  });
  // The bar track the dot rides, as of the latest render, which the tooltip's roof holds.
  const barRide = useRef<() => Track | null>(() => null);
  useLayoutEffect(() => {
    barRide.current = () =>
      series === undefined || frame === null ? null : keptBarTrack(context, series, frame, track);
  });
  const { riders } = context;
  // The dot registers again when it rides another series, so the roof reads the new track.
  useLayoutEffect(() => {
    const svg = markNode();
    if (svg === null) return undefined;
    return riders.register(svg, () => barRide.current());
  }, [markNode, dataKey, riders]);
  useLayoutEffect(() => {
    const svg = markNode();
    return () => {
      if (svg !== null) snapGlide(svg);
    };
  }, [markNode]);
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
          "--chart-series-paint": pointPaint(context, dataKey, series),
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

/** A Marker's dots and its pills' anchors, found once per commit of its mark. */
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
  const { dots, anchors } = markerParts(box);
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
  const slots = useSteady(markerSlots(context, series, at), sameItems);
  const marked = useMemo(
    () =>
      series === undefined || frame === null
        ? []
        : slots.flatMap((slot) => {
            const point = restingPoint(
              { window: context.model.window, xScale: context.xScale },
              frame,
              series,
              slot
            );
            return point === null ? [] : [{ slot, point }];
          }),
    [context.model, context.xScale, series, frame, slots]
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
  const intro = useMountIntro(context);
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
          "--chart-series-paint": pointPaint(context, dataKey, series),
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
  const active = useActiveSlot(context, datum?.slot === null);
  const slot = datum?.slot ?? active;
  const reading = datum === null || slot === null ? undefined : readingAt(context, datum.key, slot);
  const text =
    datum !== null && reading?.kind === "reading"
      ? formatValue(context.locale, reading.value, format ?? context.config[datum.key]?.format ?? {}, "tick")
          .text
      : null;
  // The text it showed before an update, which its mark's crossfade fades out.
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    noteShownText(ref.current, text ?? "", context.update);
  });
  return (
    <span ref={ref} data-slot="chart-value-label" aria-hidden="true" className={className} style={style}>
      {text}
    </span>
  );
}

Object.assign(ChartDots, { displayName: "Chart.Dots" });
Object.assign(ChartActiveDot, { displayName: "Chart.ActiveDot" });
Object.assign(ChartMarker, { displayName: "Chart.Marker" });
Object.assign(ChartValueLabel, { displayName: "Chart.ValueLabel" });
