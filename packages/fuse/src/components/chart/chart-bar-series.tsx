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
import type { BarDraw, BarLook, SeriesPaint, SideFills } from "./chart-bar-draw";
import { BarFills, ListFills } from "./chart-bar-fills";
import type { ChartRootContextValue, ChartUpdate, CommitKind } from "./chart-context";
import { useChartFollower } from "./chart-followers";
import type { ChartMotion, JoinLead, MarkValues } from "./chart-motion";
import { placementOf, useCommitMotion, useFollowerPlacement, useMotionMark } from "./chart-motion-mark";
import { valuePaint } from "./chart-paint";
import { pathAnchor } from "./chart-paths";
import type { ChartPlot } from "./chart-plot";
import type { MountPhase } from "./chart-store";
import { barCellAt, barGeometry, geometryOf, geometryRect, hangs, rectsPath } from "./layout/bar-geometry";
import { DETAIL_PARTS, drawnBar } from "./layout/bar-shapes";
import type { BarParts, BarVariant } from "./layout/bar-shapes";
import type { SeriesModel } from "./layout/cartesian-model";
import { tickWidth, valueAt } from "./layout/plot-frame";
import type { BarMetrics, PlotFrame, PlotRect, SubBand } from "./layout/plot-frame";

/** What a bar writes on `data-intro`: nothing in the entrance, `fade` after a data update, else `none`. */
function introOf(phase: MountPhase, commit: CommitKind): "fade" | "none" | undefined {
  if (phase === "initial") return undefined;
  return commit === "data" ? "fade" : "none";
}

/** Write a rectangle's geometry attributes, as a bar's JSX writes them. */
function writeRect(node: Element, { x, y, width, height }: PlotRect): void {
  node.setAttribute("x", String(x));
  node.setAttribute("y", String(y));
  node.setAttribute("width", String(Math.max(0, width)));
  node.setAttribute("height", String(Math.max(0, height)));
}

/**
 * Mark a drawn bar's body, or the active overlay, with what its drawn geometry says now: the side
 * its tip lies on, which turns its far end over, and its top weight, which scales its rounded end.
 */
function writeSide(body: SVGElement | null, negative: boolean, top: number): void {
  if (body === null) return;
  if (negative) body.setAttribute("data-negative", "");
  else body.removeAttribute("data-negative");
  body.style.setProperty("--_top", String(top));
}

/** Write a bar's shapes onto its body, or onto the body and details of its group. */
function writeParts(node: Element, parts: BarParts): void {
  if (node.tagName === "rect") {
    writeRect(node, parts.body);
    return;
  }
  for (const child of node.children) {
    const part = child.getAttribute("data-part");
    if (part === "top" || part === "side") child.setAttribute("points", parts[part] ?? "");
    else if (part === "track" || part === "blocks") child.setAttribute("d", rectsPath(parts[part] ?? []));
    else if (part === "cap") {
      if (parts.cap !== undefined) writeRect(child, parts.cap);
    } else writeRect(child, parts.body);
  }
}

/** What a bar's writer reads besides the numbers: the frame, the look and the fills by side. */
type BarWriterLook = { readonly frame: PlotFrame; readonly variant: BarVariant; readonly fills: SideFills };

/**
 * Draw one bar from the loop's numbers. Every shape it draws comes from the numbers: its rectangle,
 * seam, side, rounded end, cap and blocks track, and which side's fill it takes.
 */
function drawBar(node: SVGElement, look: BarWriterLook, values: MarkValues): void {
  const { frame, variant, fills } = look;
  const geometry = geometryOf(values);
  const negative = hangs(frame, geometry);
  const top = Math.min(1, Math.max(0, geometry[5]));
  writeParts(node, drawnBar(frame, variant, geometryRect(frame, geometry), { negative, top }));
  const body =
    node.tagName === "rect" ? node : node.querySelector<SVGElement>(':scope > [data-slot="chart-bar"]');
  writeSide(body, negative, top);
  node.querySelector<SVGElement>(':scope > [data-part="track"]')?.style.setProperty("--_top", String(top));
  node.style.setProperty("--_fill", (negative ? fills.negative : fills.positive) ?? null);
}

/** What the overlay's writer reads: the frame, and the active reading's fills, which each paint sets. */
type OverlayLook = { readonly frame: PlotFrame; readonly fills: { readonly current: SideFills } };

/** Draw the active overlay from the loop's numbers, as `drawBar` draws a bar, with no seam. */
function drawOverlay(rect: SVGRectElement, look: OverlayLook, values: MarkValues): void {
  const { frame } = look;
  const fills = look.fills.current;
  const geometry = geometryOf(values);
  const negative = hangs(frame, geometry);
  writeRect(rect, geometryRect(frame, geometry));
  writeSide(rect, negative, Math.min(1, Math.max(0, geometry[5])));
  rect.style.setProperty("--_fill", (negative ? fills.negative : fills.positive) ?? null);
}

/**
 * One bar. It keys by its slot, so a pan keeps every surviving node, and it keeps the
 * `data-intro` value its first render chose. Each commit that renders it places it through the
 * loop, which grows it in the entrance, moves it on a data update and snaps it otherwise.
 */
const BarMark = memo(function BarMark({
  bar,
  series,
  look,
  intro,
  motion,
  update,
  plot,
}: {
  readonly bar: BarDraw;
  /** The series ordinal, which every mark writes on `data-series`, per CONTRACT section 11. */
  readonly series: number;
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
  const writerLook = useMemo(
    (): BarWriterLook => ({ frame: look.frame, variant: look.variant, fills: bar.fills }),
    [look, bar.fills]
  );
  const { ref: barRef, place } = useMotionMark(motion, drawBar, writerLook, barAxes(look.frame.orientation));
  const commit = useCommitMotion(update, plot, look.frame.orientation);
  useLayoutEffect(() => {
    place(bar.geometry, barPlacement(bar, commit()), barAnchor(series, bar.cell.slot));
  });
  const parts = drawnBar(look.frame, look.variant, bar.rect, {
    negative: hangs(look.frame, bar.geometry),
    top: bar.geometry[5],
  });
  const fill = negative ? bar.fills.negative : bar.fills.positive;
  const paint = { "--chart-bar-paint": bar.paint, "--_fill": fill };
  const shared = { "data-emphasis": bar.emphasis ? "" : undefined, "data-time": bar.time };
  const plain = DETAIL_PARTS.every((part) => parts[part] === undefined);
  const body = (
    <rect
      ref={plain ? barRef : undefined}
      data-slot="chart-bar"
      data-series={series}
      data-stack-top={bar.cell.stackTop ? "" : undefined}
      data-negative={negative ? "" : undefined}
      data-quality={bar.quality}
      data-projected={bar.projected ? "" : undefined}
      data-intro={firstIntro}
      {...shared}
      {...parts.body}
      style={plain ? paint : undefined}
    />
  );
  if (plain) return body;
  return (
    <g ref={barRef} data-intro={firstIntro} style={paint}>
      {look.variant === "blocks" ? (
        // An inner segment keeps an empty track, which fades in should the segment become the top.
        <path data-slot="chart-bar-detail" data-part="track" {...shared} d={rectsPath(parts.track ?? [])} />
      ) : null}
      {body}
      {parts.cap === undefined ? null : (
        <rect data-slot="chart-bar-detail" data-part="cap" {...shared} {...parts.cap} />
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
  for (const [name, value] of Object.entries(tickEnds(look.frame, [start, end], base))) {
    line.setAttribute(name, String(value));
  }
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
  const commit = useCommitMotion(update, plot, frame.orientation);
  useLayoutEffect(() => {
    place([span[0], span[1], zero], placementOf(commit()));
  });
  return (
    <line
      ref={ref}
      data-slot="chart-bar-missing"
      data-series={series}
      style={{ "--_tick-width": `${String(tickWidth(frame.box))}px` }}
      {...tickEnds(frame, span, zero)}
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
  /** The mount phase the series saw on its first render. */
  readonly phase: MountPhase;
  /** Whether the series still runs Root's entrance, which Chart.Bar decides for both forms. */
  readonly entering: boolean;
};

/**
 * The bars of one series, one SVG element per bar. Each bar grows from its base in Root's
 * entrance, moves to its new geometry on a data update and snaps on a range step or a resize.
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
  firstUpdate,
}: SeriesDraw & {
  readonly variant: BarVariant;
  readonly emphasised: ReadonlySet<number>;
  /** Root's update when the series first rendered, which its first draw keeps under hydration. */
  readonly firstUpdate: ChartUpdate;
}): ReactElement {
  const { update, motion } = context;
  const { bars, needs, missing } = useMemo(
    () => layoutBars({ context, series, frame, metrics, sub, variant, paint, emphasised, prefix, entering }),
    [context, series, frame, metrics, sub, variant, paint, emphasised, prefix, entering]
  );
  const look = useMemo((): BarLook => ({ variant, frame }), [variant, frame]);
  // Bars of the series' first draw take its mount phase's intro, and bars that a later update
  // mounts take that update's intro.
  const intro = update === firstUpdate ? introOf(phase, update.kind) : introOf("mounted", update.kind);
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
    return { leads: [{ anchor: barAnchor(series.seriesIndex, slot), pick }] };
  }
  const route = context.paths.get(series.seriesIndex, "columns");
  const index = route?.keys.indexOf(context.update.keys[slot] ?? "") ?? -1;
  if (route === undefined || index === -1) return undefined;
  // The column's owner projects the overlay from the route's numbers, so it slides with the column.
  return {
    leads: [
      {
        anchor: pathAnchor(series.seriesIndex, "columns"),
        pick: (values: MarkValues) => columnOverlay(values, index, target[5] ?? 1),
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
  readonly variant: BarVariant;
  readonly form: "bars" | "path";
}): ReactElement {
  const { model, motion } = context;
  // The active reading's fills on either side, which each paint sets before it places the overlay.
  const fills = useRef<SideFills>({ positive: undefined, negative: undefined });
  const overlayLook = useMemo((): OverlayLook => ({ frame, fills }), [frame]);
  const {
    ref: activeRef,
    node,
    place,
  } = useMotionMark(motion, drawOverlay, overlayLook, barAxes(frame.orientation));
  const placeFor = useFollowerPlacement(context.update, plot, frame.orientation);
  useChartFollower("Chart.Bar", (active, cause) => {
    // The overlay joins what draws its slot in every paint: in the element form the bar, its whole
    // geometry with no seam, and in the path form the column, whose base and tip it takes.
    const cell = active === null ? null : barCellAt(model, series, active.slot);
    const target = cell === null ? null : barGeometry(frame, cell, metrics, sub, "whole");
    const placement = placeFor(
      cause,
      cell === null || target === null ? undefined : overlayJoin(context, series, cell.slot, target, form)
    );
    const rect = node();
    if (rect === null) return;
    if (cell === null) {
      rect.setAttribute("visibility", "hidden");
      return;
    }
    const reading = series.readings[cell.slot];
    const own =
      reading?.kind === "reading" ? valuePaint(paint.key, paint.color, paint.bins, reading.value) : undefined;
    const projected = cell.slot >= series.projectedFrom;
    const quality = reading?.kind === "reading" && reading.quality !== "measured" ? reading.quality : null;
    const toggle = (name: string, on: boolean, value = ""): void => {
      if (on) rect.setAttribute(name, value);
      else rect.removeAttribute(name);
    };
    rect.setAttribute("visibility", "visible");
    toggle("data-stack-top", cell.stackTop);
    toggle("data-projected", projected);
    toggle("data-quality", quality !== null, quality ?? "");
    fills.current = overlayFills(prefix, form, variant, paint, { own, projected });
    rect.style.setProperty("--chart-bar-paint", own ?? null);
    if (target !== null) place(target, placement);
  });
  return (
    <rect ref={activeRef} data-slot="chart-bar-active" data-series={series.seriesIndex} visibility="hidden" />
  );
}

Object.assign(SeriesBars, { displayName: "Chart.Bar.Series" });
Object.assign(ActiveBar, { displayName: "Chart.Bar.Active" });
