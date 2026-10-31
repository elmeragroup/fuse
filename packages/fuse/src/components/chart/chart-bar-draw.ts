"use client";

/**
 * Where one Bar's marks land and what they paint, as plain data: the bars of the element form, the
 * paths of the path form, each bar's parts for its look, its paint server and the way it enters.
 * The series modules render this data, and the animation loop redraws a bar's parts from each
 * frame's rectangle.
 */
import { fillId, fillKind } from "./chart-bar-fills";
import type { FillKind, FillPlot } from "./chart-bar-fills";
import type { ChartRootContextValue } from "./chart-context";
import type { Placement, ValueAxis } from "./chart-motion";
import { placementOf } from "./chart-motion-mark";
import type { Commit } from "./chart-motion-mark";
import { valuePaint } from "./chart-paint";
import type { SeriesPaint } from "./chart-paint";
import { barCells, barGeometry, barRect, geometryRect, introStep } from "./layout/bar-geometry";
import type { BarCell, BarGeometry } from "./layout/bar-geometry";
import type { BarVariant } from "./layout/bar-shapes";
import type { SeriesModel } from "./layout/cartesian-model";
import { ownBounds, ownSlot, ownSpan } from "./layout/coarse-slots";
import { CHART_STAGGER_MS } from "./layout/motion";
import { snapAcross, snapSpan, snapX, tickWidth, valueAt } from "./layout/plot-frame";
import type { BarMetrics, PlotFrame, PlotRect, SubBand } from "./layout/plot-frame";
import { slotTime } from "./layout/readings";

/** How one series lays out its bars, shared by every bar of it. */
export type BarLook = {
  readonly variant: BarVariant;
  readonly frame: PlotFrame;
};

/** One bar ready to draw. */
export type BarDraw = {
  readonly key: string;
  readonly cell: BarCell;
  /** The bar's geometry at rest, the numbers the loop tweens. */
  readonly geometry: BarGeometry;
  /** The rectangle its geometry stands for at rest. */
  readonly rect: PlotRect;
  readonly quality: string | undefined;
  readonly time: string | undefined;
  /** The bar's own paint, a scale step or the greyed paint of emphasis. The series paint otherwise. */
  readonly paint: string | undefined;
  /**
   * The paint server the bar fills from on either side of its base, as `url(#…)`, or undefined for
   * a plain fill. A role list runs from the tip, so its gradient turns over with the drawn bar.
   */
  readonly fills: SideFills;
  readonly emphasis: boolean;
  readonly projected: boolean;
  /** The entrance delay step, while the series draws its first bars in Root's entrance. */
  readonly step: number | undefined;
};

/** A missing reading's tick on the zero line, spanning the middle of the bar's place. */
export type MissingTick = { readonly key: string; readonly span: readonly [number, number] };

/** What one series draws in the element form. */
export type BarsLayout = {
  readonly bars: readonly BarDraw[];
  /** The paint servers the bars and the active overlay reference, by kind. */
  readonly needs: ReadonlyMap<FillKind, ReadonlySet<string>>;
  readonly missing: readonly MissingTick[];
};

/** What the element form lays out from. */
export type BarsInput = {
  /** What the bars read from Root: the model, the update's keys, `now` and the entrance origin. */
  readonly context: Pick<ChartRootContextValue, "model" | "update" | "now" | "intro">;
  readonly series: SeriesModel;
  readonly frame: PlotFrame;
  readonly metrics: BarMetrics;
  readonly sub: SubBand;
  readonly variant: BarVariant;
  readonly paint: SeriesPaint;
  readonly emphasised: ReadonlySet<number>;
  readonly prefix: string;
  /** Whether the bars run Root's entrance wipe, which only a browser mount's first draw does. */
  readonly entering: boolean;
};

/** A fill for a bar on each side of its base, which the drawn bar picks from in every frame. */
export type SideFills = { readonly positive: string | undefined; readonly negative: string | undefined };

/**
 * How a bar reaches its rectangle in a commit. A bar's first draw grows it from its base when it
 * runs the entrance and draws it at once otherwise, and every later commit moves, snaps or settles
 * as the commit asks.
 *
 * @param bar - The bar.
 * @param commit - What the commit asks of the bar.
 * @returns The loop's placement.
 */
export function barPlacement(bar: BarDraw, commit: Commit): Placement {
  return placementOf(commit, {
    entrance:
      bar.step === undefined
        ? undefined
        : {
            kind: "enter",
            // The bar grows its tip out of its base.
            from: bar.geometry.map((value, index) => (index === 3 ? bar.geometry[2] : value)),
            delay: bar.step * CHART_STAGGER_MS,
          },
  });
}

/**
 * The anchor a bar places itself under, which a follower at the same series and slot joins.
 *
 * @param seriesIndex - The series' ordinal.
 * @param slot - The bar's slot.
 * @returns The anchor.
 */
export function barAnchor(seriesIndex: number, slot: number): string {
  return `${String(seriesIndex)} ${String(slot)}`;
}

/**
 * What each of a bar's geometry numbers measures, for the loop: its span along the slot axis, its
 * base and tip across the value axis, and its seam and top weight, sizes the box leaves alone.
 *
 * @param orientation - The frame's orientation.
 * @returns The axes, in `BarGeometry`'s order.
 */
export function barAxes(orientation: "vertical" | "horizontal"): BarAxes {
  const [along, across] = orientation === "vertical" ? (["x", "y"] as const) : (["y", "x"] as const);
  return [along, along, across, across, "size", "size"];
}

/** What a bar's six geometry numbers measure, one axis each, in `BarGeometry`'s order. */
export type BarAxes = readonly [
  alongStart: ValueAxis,
  alongEnd: ValueAxis,
  base: ValueAxis,
  tip: ValueAxis,
  seam: "size",
  top: "size",
];

/** A bar's geometry and the rectangle it stands for at rest. */
function restingBar(frame: PlotFrame, cell: BarCell, metrics: BarMetrics, sub: SubBand) {
  const geometry = barGeometry(frame, cell, metrics, sub, "cut");
  return { geometry, rect: geometryRect(frame, geometry) };
}

/** One fill on both sides of the base. */
function sameFill(fill: string | undefined): SideFills {
  return { positive: fill, negative: fill };
}

/** A greyed paint, a quarter of the way to the muted text role, for the bars emphasis leaves out. */
function greyed(paint: string): string {
  return `color-mix(in oklab, ${paint} 75%, var(--muted-foreground))`;
}

/** The paint servers a series' bars reference, collected while the bars are laid out. */
class FillNeeds {
  readonly needs = new Map<FillKind, Set<string>>();

  constructor(private readonly prefix: string) {}

  /** The `url(#…)` of a kind's server for a paint, adding the server on first use. */
  use(kind: FillKind, paint: string): string {
    const paints = this.needs.get(kind) ?? new Set<string>();
    paints.add(paint);
    this.needs.set(kind, paints);
    return `url(#${fillId(this.prefix, kind, paint)})`;
  }
}

/**
 * A role list's gradient for a bar of the default look, from its tip to its base. Both the element
 * form and the path form define the two gradients, so the active overlay finds them in either.
 *
 * @param prefix - The series' id prefix.
 * @param variant - The series' look.
 * @param paint - The series' paint.
 * @param negative - Whether the bar hangs below zero.
 * @returns The `url(#…)`, or undefined when the series paints no role list.
 */
export function listFill(
  prefix: string,
  variant: BarVariant,
  paint: SeriesPaint,
  negative: boolean
): string | undefined {
  if (paint.stops === undefined || variant !== "default") return undefined;
  return `url(#${prefix}-list-${negative ? "negative" : "positive"})`;
}

/**
 * The fills of the active overlay on either side of its base: hatched when the reading is
 * projected, as the element form's servers draw it, and through the role list's gradient on the
 * default look, whose direction the drawn overlay picks.
 *
 * @param prefix - The series' id prefix.
 * @param form - The series' form, since only the element form defines the projected servers.
 * @param variant - The series' look.
 * @param paint - The series' paint.
 * @param bar - The active reading's own paint, and whether it is projected.
 * @returns The fills, each a `url(#…)`, or undefined for a plain fill.
 */
export function overlayFills(
  prefix: string,
  form: "bars" | "path",
  variant: BarVariant,
  paint: SeriesPaint,
  bar: { readonly own: string | undefined; readonly projected: boolean }
): SideFills {
  if (bar.projected && form === "bars")
    return sameFill(`url(#${fillId(prefix, "projected", bar.own ?? paint.base)})`);
  return {
    positive: listFill(prefix, variant, paint, false),
    negative: listFill(prefix, variant, paint, true),
  };
}

/**
 * The plot geometry the plot-anchored paint servers read.
 *
 * @param frame - The frame the series draws in.
 * @returns The plot's size and orientation.
 */
export function fillPlot(frame: PlotFrame): FillPlot {
  return { orientation: frame.orientation, width: frame.box.width, height: frame.box.height };
}

/**
 * The centre of the missing tick on the zero line. The tick is `tickWidth` wide, whole device
 * pixels, and the zero line's snapped pixel edge, where the bars' bases draw, lies inside it, half
 * its pixels from its near edge, rounded down: on its centre wherever its pixels are even.
 *
 * @param frame - The frame the series draws in.
 * @param zero - Where the zero line lies along the value axis, unsnapped, the frame's own by
 *   default. A tween hands its frame's number, which snaps here, as a bar's base snaps.
 * @returns The tick's centre along the value axis.
 */
export function missingTickAt(frame: PlotFrame, zero: number = valueAt(frame, 0)): number {
  const { dpr } = frame.box;
  const width = tickWidth(frame.box);
  const near = snapAcross(frame, zero) - Math.floor(Math.round(width * dpr) / 2) / dpr;
  return near + width / 2;
}

/**
 * The endpoints of a missing tick: its span along the slot axis, snapped with the pixel floor, on
 * the zero line drawn at a coordinate. A tween frame's numbers draw through here too.
 *
 * @param frame - The frame the series draws in.
 * @param span - The tick's span along the slot axis.
 * @param zero - Where the zero line draws along the value axis.
 * @returns The line's endpoints.
 */
export function tickEnds(frame: PlotFrame, span: readonly [number, number], zero: number) {
  const [start, end] = snapSpan(frame, span[0], span[1]);
  const at = missingTickAt(frame, zero);
  return frame.orientation === "vertical"
    ? { x1: start, x2: end, y1: at, y2: at }
    : { x1: at, x2: at, y1: start, y2: end };
}

/**
 * Lay out one series in the element form: a bar per reading and a tick per missing reading.
 *
 * @param input - The series, its frame and spacing, its look and paint.
 * @returns The bars, the paint servers they need and the missing ticks.
 */
export function layoutBars(input: BarsInput): BarsLayout {
  const { context, series, frame, metrics, sub, variant, paint, emphasised, prefix, entering } = input;
  const { model, update } = context;
  const { domain } = model;
  const window = model.window ?? { first: 0, last: -1 };
  const count = window.last - window.first + 1;
  const fills = new FillNeeds(prefix);
  const bars = barCells(model, series).map((cell): BarDraw => {
    const reading = series.readings[cell.slot];
    const value = reading?.kind === "reading" ? reading : undefined;
    const own = value === undefined ? undefined : valuePaint(paint, value.value);
    const emphasis = emphasised.has(cell.slot);
    const dimmed = emphasised.size > 0 && !emphasis;
    const barPaint = dimmed ? greyed(own ?? paint.base) : own;
    const projected = cell.slot >= series.projectedFrom;
    // The active overlay draws a projected reading in its own paint, never the greyed one.
    if (projected) fills.use("projected", own ?? paint.base);
    const kind = fillKind(variant, projected);
    return {
      key: update.keys[cell.slot] ?? String(cell.slot),
      cell,
      ...restingBar(frame, cell, metrics, sub),
      quality: value === undefined || value.quality === "measured" ? undefined : value.quality,
      time:
        domain.kind === "time" && context.now !== undefined
          ? slotTime(...ownBounds(series, domain, cell.slot), context.now)
          : undefined,
      paint: barPaint,
      fills:
        kind === null
          ? {
              positive: listFill(prefix, variant, paint, false),
              negative: listFill(prefix, variant, paint, true),
            }
          : sameFill(fills.use(kind, barPaint ?? paint.base)),
      emphasis,
      projected,
      step:
        entering && context.intro !== "none"
          ? introStep(context.intro ?? "left", cell.position, count)
          : undefined,
    };
  });
  // An empty chart draws no missing marker, as section 8.13 says.
  const missing: MissingTick[] = [];
  for (let slot = window.first; slot <= window.last && !model.empty; slot = ownSlot(series, slot)[1] + 1) {
    if (series.readings[slot]?.kind !== "missing") continue;
    const cell: BarCell = {
      slot: ownSlot(series, slot)[0],
      ...ownSpan(series, window, slot),
      extent: [0, 0],
      negative: false,
      stackTop: true,
    };
    const rect = barRect(frame, cell, metrics, sub, "whole");
    missing.push({
      key: update.keys[cell.slot] ?? String(cell.slot),
      span: frame.orientation === "vertical" ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height],
    });
  }
  return { bars, needs: fills.needs, missing };
}

/**
 * Where the past span of a path-form series ends: the end of the window's last own slot of the
 * series that ended before Root's `now`, snapped, which `data-fade="past"` dims up to. A coarse
 * series' slot is past only once its own interval ends, as the element form dates its bars.
 *
 * @param context - Root's model, `data-fade` and `now`.
 * @param series - The series.
 * @param frame - The frame the series draws in.
 * @returns The end along the slot axis, or null when the chart does not dim the past.
 */
export function pastSpanEnd(
  context: Pick<ChartRootContextValue, "model" | "fade" | "now">,
  series: SeriesModel,
  frame: PlotFrame
): number | null {
  const { model } = context;
  const { domain } = model;
  const window = model.window ?? { first: 0, last: -1 };
  if (context.fade !== "past" || context.now === undefined || domain.kind !== "time") return null;
  let past = 0;
  for (let slot = window.first; slot <= window.last; slot += 1) {
    if (slotTime(...ownBounds(series, domain, slot), context.now) === "past") past += 1;
  }
  const step = frame.box.width / Math.max(window.last - window.first + 1, 1);
  return snapX(frame.box, past * step);
}
