"use client";

/**
 * Where the marks attached to a series sit, and how they join its motion. Dots, a Marker, the
 * active dot and the active value sit on the series' drawn point at a slot: a Line's or an Area's
 * vertex, or a Bar's tip. During a data update each one joins the tween of what it sits on, so it
 * draws on its vertex or its bar in every frame.
 */
import { barAnchor } from "./chart-bar-draw";
import type { ChartRootContextValue } from "./chart-context";
import type { FollowerCause } from "./chart-followers";
import type { ChartMotion, JoinLead, MarkValues, Placement, ValueAxis } from "./chart-motion";
import { crossfade } from "./chart-path-draw";
import { joinPath } from "./chart-paths";
import type { PathRoute } from "./chart-paths";
import { geometryOf } from "./layout/bar-geometry";
import type { SeriesModel } from "./layout/cartesian-model";
import { pointAlong, slotCentreAt, snapAcross, valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";

/**
 * The value a series draws its point at: the reading, or a stacked series' outer end.
 *
 * @param series - The series.
 * @param slot - The domain slot.
 * @returns The value, or null where the series has no reading.
 */
export function pointValue(series: SeriesModel, slot: number): number | null {
  const extent = series.extents[slot];
  if (series.readings[slot]?.kind !== "reading" || extent === null || extent === undefined) return null;
  const [low, high] = extent;
  return low < 0 && high <= 0 ? low : high;
}

/**
 * A series' resting point at a slot, unsnapped, the numbers its attached marks place and tween.
 *
 * @param context - Root's context.
 * @param frame - The layout's frame.
 * @param series - The series.
 * @param slot - The domain slot.
 * @returns The point along the slot axis and across the value axis, or null without a reading.
 */
export function restingPoint(
  context: ChartRootContextValue,
  frame: PlotFrame,
  series: SeriesModel,
  slot: number
): readonly [number, number] | null {
  const window = context.model.window;
  const value = pointValue(series, slot);
  if (window === null || value === null) return null;
  return [slotCentreAt(frame, slot - window.first, context.xScale), valueAt(frame, value)];
}

/**
 * Draw a point mark's centre from its numbers, on the column of the slot's crosshair and the device
 * pixel of its value, as the path's vertex draws.
 *
 * @param frame - The layout's frame.
 * @param xScale - Root's x scale.
 * @param along - The unsnapped coordinate along the slot axis.
 * @param across - The unsnapped coordinate along the value axis.
 * @returns The centre as SVG `cx` and `cy`.
 */
export function pointCentre(
  frame: PlotFrame,
  xScale: "band" | "point",
  along: number,
  across: number
): { cx: number; cy: number } {
  const x = pointAlong(frame, along, xScale);
  const y = snapAcross(frame, across);
  return frame.orientation === "vertical" ? { cx: x, cy: y } : { cx: y, cy: x };
}

/**
 * How attached marks join what they sit on: one lead per mark that moves, read at rest as in
 * motion, and the crossfade of the path commit they follow, or null.
 */
export type FollowerJoin = {
  readonly leads: readonly JoinLead[];
  readonly crossfade: object | null;
};

/**
 * How marks at some of a series' slots join the motion of what they sit on. A dot, a marker or the
 * active dot prefers the series' line, and a value follower prefers its bars, a Bar's columns in
 * the path form or the bar at each slot. Each falls back to the other. Every selected slot joins
 * its own bar, so tied extrema and a listed selection each rest on their bar's middle.
 *
 * @param context - Root's context.
 * @param series - The series.
 * @param slots - The marks' domain slots, in the order of their numbers.
 * @param rest - The marks' resting numbers, a place and a value each.
 * @param prefer - What the marks sit on first, where the series draws both.
 * @returns The join, or undefined when nothing the marks sit on moves.
 */
export function attachJoin(
  context: ChartRootContextValue,
  series: SeriesModel,
  slots: readonly number[],
  rest: MarkValues,
  prefer: "line" | "bar"
): FollowerJoin | undefined {
  const first = context.model.window?.first ?? 0;
  const marks = slots.map((slot) => ({
    key: context.update.keys[slot] ?? String(slot),
    position: slot - first,
  }));
  const line = context.paths.get(series.seriesIndex, "line");
  const columns = context.paths.get(series.seriesIndex, "columns");
  // A bar's drawn middle along the slot axis, then its tip, in its sub-band at rest as in motion.
  const tip = (values: MarkValues) => {
    const geometry = geometryOf(values);
    return [(geometry[0] + geometry[1]) / 2, geometry[3]];
  };
  const bars: FollowerJoin | undefined =
    slots.length === 0 || !context.drawsBar(series.key)
      ? undefined
      : {
          leads: slots.map((slot) => ({ anchor: barAnchor(series.seriesIndex, slot), pick: tip, rest: tip })),
          crossfade: null,
        };
  const onPath = (route: PathRoute | undefined, kind: "line" | "columns"): FollowerJoin | undefined =>
    route === undefined
      ? undefined
      : { leads: joinPath(route, series.seriesIndex, kind, marks, rest), crossfade: route.crossfade };
  const onLine = onPath(line, "line");
  const onColumns = onPath(columns, "columns");
  return prefer === "line" ? (onLine ?? onColumns ?? bars) : (onColumns ?? bars ?? onLine);
}

/**
 * How an attached mark last showed: a copy of its live node, text included, the look it drew with,
 * and the last crossfade it saw.
 */
export type AttachedShown<L> = {
  readonly node: Element;
  readonly look: L;
  readonly crossfade: object | null;
};

/**
 * Place an attached mark. When the path commit it follows crossfades the path, the mark crossfades
 * with it, once: the copy it kept of how it last showed, its pills' old text included, fades out
 * where the loop last drew it, in an element beside the live one, and the mark lands on its new
 * place and fades in. A pointer or key step never starts one. Otherwise it takes its placement.
 * Either way it keeps a copy of its live node for the next commit.
 *
 * @param input - The mark's join, node, outgoing element and writer, and what it showed last.
 */
export function placeAttached<L>(input: {
  readonly motion: ChartMotion;
  /** What moved the mark: a commit, or a pointer or key step. */
  readonly cause: FollowerCause;
  /** What the mark joins, which names the crossfade it follows. */
  readonly join: { readonly crossfade: object | null } | undefined;
  readonly placement: Placement;
  /** Places the mark's numbers, its resting ones, with a placement. */
  readonly place: (placement: Placement) => void;
  readonly node: Element | null;
  /** The empty element the old drawing fades out in. */
  readonly outgoing: Element | null;
  /** What the loop drew last for the mark. */
  readonly before: MarkValues | null;
  readonly look: L;
  readonly shown: { current: AttachedShown<L> | null };
  /** The mark's writer, which draws the old numbers on the copy. */
  readonly draw: (copy: Element, look: L, values: MarkValues) => void;
}): void {
  const { node, outgoing, before, shown } = input;
  const old = shown.current;
  const fade = input.join?.crossfade ?? null;
  if (
    input.cause === "commit" &&
    fade !== null &&
    fade !== old?.crossfade &&
    node !== null &&
    outgoing !== null &&
    before !== null &&
    old !== null &&
    !input.motion.reduced()
  ) {
    crossfade(node, outgoing, (copy) => input.draw(copy, old.look, before), old.node);
    // The path snapped, so a join lands on its rest, and anything else snaps.
    input.place(input.placement.kind === "join" ? input.placement : { kind: "snap" });
  } else input.place(input.placement);
  const copy = node?.cloneNode(true);
  shown.current = copy instanceof Element ? { node: copy, look: input.look, crossfade: fade } : null;
}

/**
 * What each number of a point mark measures, a place along the slot axis then a value, which the
 * loop repeats for a mark that holds several points.
 *
 * @param orientation - Root's orientation.
 * @returns One point's axes.
 */
export function pointAxes(orientation: "vertical" | "horizontal"): ValueAxis[] {
  return orientation === "vertical" ? ["x", "y"] : ["y", "x"];
}
