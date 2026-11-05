"use client";

/**
 * The element form of one Bar, an SVG element per bar, and the active overlay every Bar draws over
 * the active slot. Each bar and the overlay hold one registration with Root's animation loop for
 * as long as they are mounted, through `useMotionMark`.
 */
import { memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

import { columnOverlay } from "./chart-bar-columns";
import {
  barAnchor,
  barAxes,
  barPlacement,
  fillPlot,
  layoutBars,
  tickEnds,
  overlayFills,
} from "./chart-bar-draw";
import type { BarDraw, BarLook, SideFills } from "./chart-bar-draw";
import { BarFills, ListFills } from "./chart-bar-fills";
import type { ChartRootContextValue, ChartUpdate } from "./chart-context";
import { partsCache, writeAttribute, writeAttributes, writeStyle } from "./chart-dom";
import { useChartFollower } from "./chart-followers";
import type { ChartMotion, JoinLead, MarkValues } from "./chart-motion";
import {
  placementOf,
  useCommitMotion,
  useFirstDraw,
  useFollowerPlacement,
  useMotionMark,
} from "./chart-motion-mark";
import type { SeriesPaint } from "./chart-paint";
import { readingPaint } from "./chart-paint";
import { pathAnchor, routeIndex } from "./chart-paths";
import type { ChartPlot } from "./chart-plot-measure";
import { stackFloorsOf, useStackSeat } from "./chart-stack-floors";
import type { StackFloors, StackSeat } from "./chart-stack-floors";
import { introFor } from "./chart-store";
import type { EntrancePhase } from "./chart-store";
import type { ChartBarVariant } from "./chart-types";
import {
  barCellAt,
  barGeometry,
  geometryOf,
  geometryRect,
  hangs,
  plainRect,
  rectsPath,
} from "./layout/bar-geometry";
import type { BarGeometry } from "./layout/bar-geometry";
import { DETAIL_PARTS, boxPoints, detailParts, drawnBar } from "./layout/bar-shapes";
import type { SeriesModel } from "./layout/cartesian-model";
import { floorSpanOf } from "./layout/floor-settle";
import { tickWidth, valueAt } from "./layout/plot-frame";
import type { BarMetrics, PlotFrame, PlotRect, StackPlace, SubBand } from "./layout/plot-frame";

/**
 * Mark a drawn bar's body, or the active overlay, with what its drawn geometry says now: the side
 * its tip lies on, which turns its far end over, and its top weight, which scales its rounded end.
 */
function writeSide(body: SVGElement | null, negative: boolean, top: number): void {
  if (body === null) return;
  writeAttribute(body, "data-negative", negative ? "" : null);
  writeStyle(body, "--_top", String(top));
}

/** A bar's top weight, from its drawn geometry, between 0 and 1. */
function topWeight(geometry: MarkValues): number {
  return Math.min(1, Math.max(0, geometry[5] ?? 0));
}

/** Write a rectangle onto a polygon's points, as a bar's JSX writes them. */
function writeBox(node: Element, rect: PlotRect): void {
  writeAttribute(node, "points", boxPoints(rect));
}

/**
 * What a bar's writer reads besides the numbers: the frame, the look, the fills by side, and for a
 * stacked bar its seat among the stack floors, which decide in each frame whether it owns its
 * side's pixel floor. A loose bar always owns its own.
 */
type BarWriterLook = {
  readonly frame: PlotFrame;
  readonly variant: ChartBarVariant;
  readonly fills: SideFills;
  readonly seat: StackSeat | null;
};

/** The elements a bar draws into: its body, and the details of a look that adds parts. */
type BarElements = { readonly body: Element | null; readonly details: readonly Element[] };

/**
 * A bar's elements, found once per commit of its mark. A plain bar is its polygon alone, whatever
 * it holds, such as a title. A look with details renders a group, whose body and details carry
 * their slots.
 */
const barElements = partsCache((node): BarElements =>
  node.tagName === "polygon"
    ? { body: node, details: [] }
    : {
        body: node.querySelector(':scope > [data-slot="chart-bar"]'),
        details: [...node.querySelectorAll(':scope > [data-slot="chart-bar-detail"]')],
      }
);

/**
 * Draw one bar from the loop's numbers. Every shape it draws comes from the numbers: its rectangle,
 * seam, side, rounded end, cap and blocks track, and which side's fill it takes. A stacked bar
 * records its segment with the stack floors, which paint it with the place they decide.
 */
function drawBar(node: SVGElement, look: BarWriterLook, values: MarkValues): void {
  const { frame, seat } = look;
  // The geometry is a copy of the numbers, which the loop draws a tween's frames into and reuses.
  const geometry = geometryOf(values);
  // The bar's span: the device pixel columns it covers along the slot axis, a coarse bar's whole
  // run among them, and the pixels it covers along the value axis with no floor.
  const plain = plainRect(frame, geometry);
  if (seat === null) {
    paintBar(node, look, geometry, "outer", plain);
    return;
  }
  const [, , base, tip] = geometry;
  seat.floors.draw(
    seat.mark,
    seat.stack,
    [floorSpanOf(frame, plain, seat.series, [base, tip])],
    frame,
    (kept) => paintBar(node, look, geometry, kept[0] === 1 ? "outer" : "inner", plain)
  );
}

/** Paint one bar from its geometry and plain rectangle, owning its stack side's pixel floor or not. */
function paintBar(
  node: SVGElement,
  look: BarWriterLook,
  geometry: BarGeometry,
  place: StackPlace,
  plain: PlotRect
): void {
  const { frame, variant, fills } = look;
  const negative = hangs(frame, geometry);
  const top = topWeight(geometry);
  const drawn = drawnBar(frame, variant, geometryRect(frame, geometry, place, plain), {
    negative,
    top,
    place,
  });
  const { body, details } = barElements(node);
  if (body instanceof SVGElement) {
    writeBox(body, drawn.body);
    writeSide(body, negative, top);
  }
  for (const detail of details) {
    const part = detail.getAttribute("data-part");
    if (part === "top" || part === "side") writeAttribute(detail, "points", drawn[part] ?? "");
    else if (part === "track" || part === "blocks") writeAttribute(detail, "d", rectsPath(drawn[part] ?? []));
    else if (part === "cap" && drawn.cap !== undefined) writeBox(detail, drawn.cap);
    if (part === "track" && detail instanceof SVGElement) writeStyle(detail, "--_top", String(top));
  }
  writeStyle(node, "--_fill", (negative ? fills.negative : fills.positive) ?? null);
}

/**
 * What the overlay's writer reads: the frame, the active reading's fills and resting place, which
 * each paint sets, and on a stack where its series reads the stack floors. The overlay draws after
 * the marks it joins in every frame, so it takes the floor owner they decided, and the stack floors
 * redraw it where it rests when that owner changes.
 */
type OverlayLook = {
  readonly frame: PlotFrame;
  readonly fills: { readonly current: SideFills };
  /** The active reading's place at rest, where its series draws no span under the overlay. */
  readonly rest: { readonly current: StackPlace };
  readonly seat: { readonly floors: StackFloors; readonly stack: string; readonly series: string } | null;
};

/** Draw the active overlay from the loop's numbers, as `drawBar` draws a bar, with no seam. */
function drawOverlay(overlay: SVGPolygonElement, look: OverlayLook, values: MarkValues): void {
  const { frame, seat } = look;
  const fills = look.fills.current;
  const geometry = geometryOf(values);
  const negative = hangs(frame, geometry);
  const plain = plainRect(frame, geometry);
  // On a stack the overlay takes the place of its series' spans under the device pixel columns it
  // covers, on the side of zero its drawn tip lies in this frame, whether a bar, a path column or
  // a decimated bucket's column draws them.
  const [, , base, tip] = geometry;
  const place =
    seat === null
      ? "outer"
      : (seat.floors.placeOver(seat.stack, floorSpanOf(frame, plain, seat.series, [base, tip]), frame) ??
        look.rest.current);
  writeBox(overlay, geometryRect(frame, geometry, place, plain));
  writeSide(overlay, negative, topWeight(geometry));
  writeStyle(overlay, "--_fill", (negative ? fills.negative : fills.positive) ?? null);
}

/**
 * One bar. It keys by its slot, so a pan keeps every surviving node, and it keeps the
 * `data-intro` value its first render chose. Each commit that renders it places it through the
 * loop, which grows it in the entrance, moves it on a data update and snaps it otherwise.
 */
const BarMark = memo(function BarMark({
  bar,
  series,
  stack,
  seriesKey,
  look,
  intro,
  motion,
  update,
  plot,
}: {
  readonly bar: BarDraw;
  /** The series ordinal, which every mark writes on `data-series`, per CONTRACT section 11. */
  readonly series: number;
  /** The series' stack, or undefined for a loose series. */
  readonly stack: string | undefined;
  /** The series' config key, which names the bar's spans among the stack floors. */
  readonly seriesKey: string;
  readonly look: BarLook;
  readonly intro: "fade" | "none" | undefined;
  readonly motion: ChartMotion;
  readonly update: ChartUpdate;
  readonly plot: ChartPlot;
}) {
  const [firstIntro] = useState(intro);
  const negative = bar.cell.negative;
  // A tween frame draws the bar from its drawn geometry alone, the numbers a follower at its end
  // tweens too, so the bar and its followers agree in every frame, across zero as well.
  // The look keys on the fill strings, which a data commit lays out again for an unchanged bar.
  const { positive, negative: negativeFill } = bar.fills;
  const seat = useStackSeat(motion, stack, seriesKey);
  const writerLook = useMemo(
    (): BarWriterLook => ({
      frame: look.frame,
      variant: look.variant,
      fills: { positive, negative: negativeFill },
      seat,
    }),
    [look, positive, negativeFill, seat]
  );
  // The parts the bar's look draws at its top weight, which its children follow.
  const detail = detailParts(look.variant, bar.geometry[5]);
  const { ref: barRef, place } = useMotionMark(
    motion,
    drawBar,
    writerLook,
    barAxes(look.frame.orientation),
    detail
  );
  const commit = useCommitMotion(update, plot, look.frame.orientation, look.frame);
  useLayoutEffect(() => {
    place(bar.geometry, barPlacement(bar, commit()), barAnchor(series, bar.cell.slot));
  });
  // React writes the geometry of the bar's first render, its top weight included, and the loop
  // writes it from then on, in the layout effect of every commit and in every frame. The loop's
  // first draw then writes nothing, and a data update's commit changes no bar's geometry. A look
  // that adds or drops a part renders its own geometry.
  const { parts, top } = useFirstDraw(
    () => ({
      parts: drawnBar(look.frame, look.variant, bar.rect, {
        negative: hangs(look.frame, bar.geometry),
        top: bar.geometry[5],
        place: bar.cell.place,
      }),
      top: String(topWeight(bar.geometry)),
    }),
    detail
  );
  const fill = negative ? negativeFill : positive;
  const paint = { "--chart-bar-paint": bar.paint, "--_fill": fill };
  const shared = { "data-emphasis": bar.emphasis ? "" : undefined, "data-time": bar.time };
  const plain = DETAIL_PARTS.every((part) => parts[part] === undefined);
  const body = (
    <polygon
      ref={plain ? barRef : undefined}
      data-slot="chart-bar"
      data-series={series}
      data-stack-top={bar.cell.stackTop ? "" : undefined}
      data-negative={negative ? "" : undefined}
      data-quality={bar.quality}
      data-projected={bar.projected ? "" : undefined}
      data-intro={firstIntro}
      {...shared}
      points={boxPoints(parts.body)}
      style={plain ? { ...paint, "--_top": top } : { "--_top": top }}
    />
  );
  if (plain) return body;
  return (
    <g ref={barRef} data-intro={firstIntro} style={paint}>
      {look.variant === "blocks" ? (
        // An inner segment keeps an empty track, which fades in should the segment become the top.
        <path
          data-slot="chart-bar-detail"
          data-part="track"
          {...shared}
          d={rectsPath(parts.track ?? [])}
          style={{ "--_top": top }}
        />
      ) : null}
      {body}
      {parts.cap === undefined ? null : (
        <polygon data-slot="chart-bar-detail" data-part="cap" {...shared} points={boxPoints(parts.cap)} />
      )}
      {parts.top === undefined ? null : (
        <polygon data-slot="chart-bar-detail" data-part="top" {...shared} points={parts.top} />
      )}
      {parts.side === undefined ? null : (
        <polygon data-slot="chart-bar-detail" data-part="side" {...shared} points={parts.side} />
      )}
      {parts.blocks === undefined ? null : (
        <path data-slot="chart-bar-detail" data-part="blocks" {...shared} d={rectsPath(parts.blocks)} />
      )}
    </g>
  );
});

/** Draw a missing tick from the loop's numbers: its span along the slot axis and its zero line. */
function drawTick(line: SVGLineElement, look: { readonly frame: PlotFrame }, values: MarkValues): void {
  const [start = 0, end = 0, base = 0] = values;
  writeAttributes(line, tickEnds(look.frame, [start, end], base));
}

/**
 * One missing reading's tick on the zero line. It moves with the bars on a data update, its zero
 * line with their base, and snaps as they do on a range step or an orientation change.
 */
const MissingTick = memo(function MissingTick({
  span,
  zero,
  series,
  frame,
  motion,
  update,
  plot,
}: {
  readonly span: readonly [number, number];
  /** Where the zero line lies, unsnapped, the number the bars' bases tween. */
  readonly zero: number;
  readonly series: number;
  readonly frame: PlotFrame;
  readonly motion: ChartMotion;
  readonly update: ChartUpdate;
  readonly plot: ChartPlot;
}) {
  const vertical = frame.orientation === "vertical";
  const tickLook = useMemo(() => ({ frame }), [frame]);
  const { ref, place } = useMotionMark(
    motion,
    drawTick,
    tickLook,
    vertical ? (["x", "x", "y"] as const) : (["y", "y", "x"] as const)
  );
  const commit = useCommitMotion(update, plot, frame.orientation, frame);
  useLayoutEffect(() => {
    place([span[0], span[1], zero], placementOf(commit()));
  });
  // React draws the first rest, and the loop draws every frame after it.
  const ends = useFirstDraw(() => tickEnds(frame, span, zero));
  return (
    <line
      ref={ref}
      data-slot="chart-bar-missing"
      data-series={series}
      style={{ "--_tick-width": `${String(tickWidth(frame.box))}px` }}
      {...ends}
    />
  );
});

/** What a series draws from, shared by its element form, its path form and its overlay. */
export type SeriesDraw = {
  readonly context: ChartRootContextValue;
  readonly series: SeriesModel;
  readonly frame: PlotFrame;
  readonly plot: ChartPlot;
  /** The Bar's own spacing, which a BarGroup or the Bar itself may set. */
  readonly metrics: BarMetrics;
  readonly sub: SubBand;
  readonly paint: SeriesPaint;
  readonly prefix: string;
  /** Root's entrance phase as the series draws, which the bars that mount now take their intro from. */
  readonly phase: EntrancePhase;
  /** Whether the series draws in Root's waiting entrance, which Chart.Bar decides for both forms. */
  readonly entering: boolean;
};

/**
 * The bars of one series, one SVG element per bar. Each bar waits at its base while Root's
 * entrance waits and grows from it as the entrance plays, moves to its new geometry on a data
 * update and snaps on a range step or a resize.
 */
export function SeriesBars({
  context,
  series,
  frame,
  plot,
  metrics,
  sub,
  variant,
  paint,
  emphasised,
  prefix,
  phase,
  entering,
}: SeriesDraw & {
  readonly variant: ChartBarVariant;
  readonly emphasised: ReadonlySet<number>;
}): ReactElement {
  const { model, update, now, intro: origin, motion } = context;
  const { bars, needs, missing } = useMemo(
    () =>
      layoutBars({
        context: { model, update, now, intro: origin },
        series,
        frame,
        metrics,
        sub,
        variant,
        paint,
        emphasised,
        prefix,
        entering,
      }),
    [model, update, now, origin, series, frame, metrics, sub, variant, paint, emphasised, prefix, entering]
  );
  const look = useMemo((): BarLook => ({ variant, frame }), [variant, frame]);
  // A bar that mounts while the entrance waits writes nothing, as its entrance runs in the loop,
  // and one that mounts after it started takes its update's intro.
  const intro = introFor(phase, update.kind, true);
  const zero = valueAt(frame, 0);
  return (
    <>
      <defs>
        <BarFills prefix={prefix} needs={needs} plot={fillPlot(frame)} />
        {paint.stops === undefined ? null : (
          <ListFills prefix={prefix} stops={paint.stops} orientation={frame.orientation} />
        )}
      </defs>
      <g data-slot="chart-bar-marks">
        {bars.map((bar) => (
          <BarMark
            key={bar.key}
            bar={bar}
            series={series.seriesIndex}
            stack={series.stack}
            seriesKey={series.key}
            look={look}
            intro={intro}
            motion={motion}
            update={update}
            plot={plot}
          />
        ))}
        {missing.map(({ key, span }) => (
          <MissingTick
            key={key}
            span={span}
            zero={zero}
            series={series.seriesIndex}
            frame={frame}
            motion={motion}
            update={update}
            plot={plot}
          />
        ))}
      </g>
    </>
  );
}

/**
 * How the active overlay joins the mark that draws its slot: the bar at the series and slot in the
 * element form, and the series' columns in the path form, whose route the paths record keeps.
 */
function overlayJoin(
  context: ChartRootContextValue,
  series: SeriesModel,
  slot: number,
  target: readonly number[],
  form: "bars" | "path"
): { readonly leads: readonly JoinLead[] } | undefined {
  if (form === "bars") {
    const pick = (values: MarkValues) => values.map((value, index) => (index === 4 ? 0 : value));
    return { leads: [{ anchor: barAnchor(series.seriesIndex, slot), pick, size: target.length }] };
  }
  const route = context.paths.get(series.seriesIndex, "columns");
  const index = route === undefined ? undefined : routeIndex(route, context.update.keys[slot] ?? "");
  if (route === undefined || index === undefined) return undefined;
  // The column's owner projects the overlay from the route's numbers, so it slides with the column.
  return {
    leads: [
      {
        anchor: pathAnchor(series.seriesIndex, "columns"),
        pick: (values: MarkValues) => columnOverlay(values, index, target[5] ?? 1),
        size: target.length,
      },
    ],
  };
}

/**
 * The series' bar over the active slot, drawn over the dimmed bars at full strength. Root paints
 * it at pointer rate, so a pointer move renders nothing in React.
 */
export function ActiveBar({
  context,
  series,
  frame,
  plot,
  metrics,
  sub,
  variant,
  paint,
  prefix,
  form,
}: Omit<SeriesDraw, "phase" | "entering"> & {
  readonly variant: ChartBarVariant;
  readonly form: "bars" | "path";
}): ReactElement {
  const { model, motion } = context;
  // The active reading's fills on either side and its resting place, which each paint sets before
  // it places the overlay.
  const fills = useRef<SideFills>({ positive: undefined, negative: undefined });
  const rest = useRef<StackPlace>("outer");
  const { stack, key } = series;
  const overlayLook = useMemo(
    (): OverlayLook => ({
      frame,
      fills,
      rest,
      seat: stack === undefined ? null : { floors: stackFloorsOf(motion), stack, series: key },
    }),
    [frame, motion, stack, key]
  );
  const {
    ref: activeRef,
    node,
    drawn,
    place,
  } = useMotionMark(motion, drawOverlay, overlayLook, barAxes(frame.orientation));
  // The overlay redraws where it rests when its stack's floors change, even while its own numbers
  // rest.
  useLayoutEffect(() => {
    const { seat } = overlayLook;
    if (seat === null) return undefined;
    return seat.floors.watch(seat.stack, () => {
      const overlay = node();
      const values = drawn();
      if (overlay !== null && values !== null) drawOverlay(overlay, overlayLook, values);
    });
  }, [overlayLook, node, drawn]);
  const placeFor = useFollowerPlacement(context.update, plot, frame.orientation, frame);
  useChartFollower("Chart.Bar", (active, cause) => {
    // The overlay joins what draws its slot in every paint: in the element form the bar, its whole
    // geometry with no seam, and in the path form the column, whose base and tip it takes.
    const cell = active === null ? null : barCellAt(model, series, active.slot);
    const target = cell === null ? null : barGeometry(frame, cell, metrics, sub, "whole");
    const placement = placeFor(
      cause,
      cell === null || target === null ? undefined : overlayJoin(context, series, cell.slot, target, form)
    );
    const overlay = node();
    if (overlay === null) return;
    if (cell === null) {
      writeAttribute(overlay, "visibility", "hidden");
      return;
    }
    const reading = series.readings[cell.slot];
    const own = readingPaint(paint, reading);
    const projected = cell.slot >= series.projectedFrom;
    const quality = reading?.kind === "reading" && reading.quality !== "measured" ? reading.quality : null;
    writeAttributes(overlay, {
      visibility: "visible",
      "data-stack-top": cell.stackTop ? "" : null,
      "data-projected": projected ? "" : null,
      "data-quality": quality,
    });
    fills.current = overlayFills(prefix, form, variant, paint, { own, projected });
    rest.current = cell.place;
    writeStyle(overlay, "--chart-bar-paint", own ?? null);
    if (target !== null) place(target, placement);
  });
  return (
    <polygon
      ref={activeRef}
      data-slot="chart-bar-active"
      data-series={series.seriesIndex}
      visibility="hidden"
    />
  );
}

Object.assign(SeriesBars, { displayName: "Chart.Bar.Series" });
Object.assign(ActiveBar, { displayName: "Chart.Bar.Active" });
