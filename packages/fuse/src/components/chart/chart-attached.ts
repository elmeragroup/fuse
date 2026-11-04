"use client";

/**
 * Where the marks attached to a series sit, and how they join its motion. Dots, a Marker, the
 * active dot and the active value sit on the series' drawn point at a slot: a Line's or an Area's
 * vertex, or a Bar's tip. During a data update each one joins the tween of what it sits on, so it
 * draws on its vertex or its bar in every frame.
 */
import { useRef } from "react";
import type { RefCallback, RefObject } from "react";

import { barAnchor } from "./chart-bar-draw";
import type { ChartRootContextValue, ChartUpdate } from "./chart-context";
import type { FollowerCause } from "./chart-followers";
import type { ChartMotion, JoinLead, MarkValues, Placement, ValueAxis } from "./chart-motion";
import { useFollowerPlacement, useMotionMark } from "./chart-motion-mark";
import type { MarkTuple, MotionWriter, WriterLook } from "./chart-motion-mark";
import { crossfade } from "./chart-path-draw";
import { joinPath } from "./chart-paths";
import type { PathKind } from "./chart-paths";
import type { ChartFrame } from "./chart-plot";
import { geometryOf } from "./layout/bar-geometry";
import type { SeriesModel } from "./layout/cartesian-model";
import { ownCentre, ownSlot } from "./layout/coarse-slots";
import { pointAlong, slotCentreAt, snapAcross, valueAt } from "./layout/plot-frame";
import type { PlotFrame } from "./layout/plot-frame";
import type { SlotWindow } from "./layout/slot-window";

/**
 * The value a series draws its point at: the reading, or a stacked series' outer end.
 *
 * @param series - The series.
 * @param slot - The domain slot.
 * @returns The value, or null where the series has no reading.
 */
function pointValue(series: SeriesModel, slot: number): number | null {
  const extent = series.extents[slot];
  if (series.readings[slot]?.kind !== "reading" || extent === null || extent === undefined) return null;
  const [low, high] = extent;
  return low < 0 && high <= 0 ? low : high;
}

/** What a resting point reads besides the frame and the series: the model's window and Root's x scale. */
export type PointPlace = {
  readonly window: SlotWindow | null;
  readonly xScale: "band" | "point";
};

/**
 * A series' resting point at a slot, unsnapped, the numbers its attached marks place and tween.
 *
 * @param place - The model's window and Root's x scale.
 * @param frame - The layout's frame.
 * @param series - The series.
 * @param slot - The domain slot.
 * @returns The point along the slot axis and across the value axis, or null without a reading.
 */
export function restingPoint(
  place: PointPlace,
  frame: PlotFrame,
  series: SeriesModel,
  slot: number
): readonly [number, number] | null {
  const { window, xScale } = place;
  const value = pointValue(series, slot);
  if (window === null || value === null) return null;
  return [slotCentreAt(frame, ownCentre(series, window, slot), xScale), valueAt(frame, value)];
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

/** What an attached mark can join: a series path of one kind, or the series' bars. */
export type FollowedKind = PathKind | "bars";

/**
 * Which drawing of a series an attached mark follows, first to last, when the series draws several.
 * A point mark sits on the line, then the area, then the columns, then the bars. A value on bars
 * sits on the columns or the bars first.
 */
const FOLLOWS = {
  line: ["line", "area", "columns", "bars"],
  bar: ["columns", "bars", "line", "area"],
} as const satisfies Record<string, readonly FollowedKind[]>;

/**
 * Which drawing of a series its attached marks sit on: the first in `FOLLOWS` order that draws the
 * series, or undefined when none does. Attaching and an active dot's ride both read it, so a dot
 * rides the drawing it joins.
 *
 * @param context - Root's context.
 * @param series - The series.
 * @param prefer - What the marks sit on first, where the series draws both.
 * @returns The drawing's kind, or undefined.
 */
export function followedKind(
  context: ChartRootContextValue,
  series: SeriesModel,
  prefer: "line" | "bar"
): FollowedKind | undefined {
  return FOLLOWS[prefer].find((kind) =>
    kind === "bars" ? context.drawsBar(series.key) : context.paths.get(series.seriesIndex, kind) !== undefined
  );
}

/**
 * A bar's drawn middle along the slot axis, then its tip, in its sub-band, at rest as in motion.
 *
 * @param values - The bar's numbers.
 * @returns The middle and the tip, in plot pixels.
 */
export function barTip(values: MarkValues): [number, number] {
  const geometry = geometryOf(values);
  return [(geometry[0] + geometry[1]) / 2, geometry[3]];
}

/**
 * How marks at some of a series' slots join the motion of what they sit on, the drawing
 * `followedKind` names. Every selected slot joins its own bar, so tied extrema and a listed
 * selection each rest on their bar's middle.
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
  const window = context.model.window ?? { first: 0, last: 0 };
  // A coarse series draws one vertex and one bar per own slot, which every Root slot it holds joins.
  const owned = slots.map((slot) => ownSlot(series, slot)[0]);
  const marks = owned.map((slot) => ({
    key: context.update.keys[slot] ?? String(slot),
    position: ownCentre(series, window, slot),
  }));
  const kind = followedKind(context, series, prefer);
  if (kind === undefined) return undefined;
  if (kind === "bars") {
    return slots.length === 0
      ? undefined
      : {
          leads: owned.map((slot) => ({
            anchor: barAnchor(series.seriesIndex, slot),
            pick: barTip,
            rest: barTip,
            size: 2,
          })),
          crossfade: null,
        };
  }
  const route = context.paths.get(series.seriesIndex, kind);
  return route === undefined
    ? undefined
    : { leads: joinPath(route, series.seriesIndex, kind, marks, rest), crossfade: route.crossfade };
}

/**
 * How an attached mark last showed at a commit: the copy it kept of its live node, text included,
 * the look it drew with, and the last crossfade it saw.
 */
export type AttachedShown<L> = {
  readonly node: Element;
  readonly look: L;
  readonly crossfade: object | null;
};

/**
 * How an attached mark keeps its last drawing for a crossfade. It keeps it on commit paints and on
 * the first paint that shows the mark.
 */
export type AttachedCopy = {
  /** The copy to keep of the live node, a deep clone unless the mark keeps less. */
  readonly keep?: (live: Element) => Element;
  /**
   * The drawing that fades out, from the kept copy, the numbers the loop drew last and the update
   * that crossfades, built only when a crossfade starts.
   */
  readonly outgoing?: (kept: Element, before: MarkValues, update: ChartUpdate) => Element | null;
  /**
   * Bring the kept copy up to what the live node shows after a pointer or key step, which keeps no
   * new copy, such as an active dot's paint at its new slot. A later crossfade then fades out what
   * showed just before its update.
   */
  readonly sync?: (kept: Element, live: Element) => void;
};

/** Each value label's text, the update it rendered last and its text before that update. */
const shownTexts = new WeakMap<
  Element,
  { readonly update: ChartUpdate; readonly before: string; readonly now: string }
>();

/**
 * Note the text a label rendered under an update, in its layout effect, so a crossfade that copies
 * the label's mark can fade out the text it showed before the update.
 *
 * @param node - The label's node, or null before it mounts.
 * @param text - The text it rendered.
 * @param update - Root's update it rendered under.
 */
export function noteShownText(node: Element | null, text: string, update: ChartUpdate): void {
  if (node === null) return;
  const last = shownTexts.get(node);
  const before = last === undefined ? text : last.update === update ? last.before : last.now;
  shownTexts.set(node, { update, before, now: text });
}

/**
 * Copy a mark that holds value labels as it showed before an update: a deep copy of the live node
 * whose labels take the text they showed before it.
 *
 * @param live - The mark's live node.
 * @param update - The update that crossfades.
 * @returns The copy.
 */
export function copyBefore(live: Element, update: ChartUpdate): Element {
  const copy = deepCopy(live);
  const selector = '[data-slot="chart-value-label"]';
  const labels = [...copy.querySelectorAll(selector)];
  live.querySelectorAll(selector).forEach((label, index) => {
    const shown = shownTexts.get(label);
    const copied = labels[index];
    if (shown === undefined || copied === undefined) return;
    copied.textContent = shown.update === update ? shown.before : shown.now;
  });
  return copy;
}

/**
 * Place an attached mark. When the path commit it follows crossfades the path, the mark crossfades
 * with it, once: the copy it kept of how it last showed, its pills' old text included, fades out
 * where the loop last drew it, in an element beside the live one, and the mark lands on its new
 * place and fades in. A pointer or key step never starts one. Otherwise it takes its placement.
 * It keeps a copy of its live node as its `copy` says, for the next crossfade.
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
  readonly copy: AttachedCopy;
  /** Root's update, which names the crossfade's old text. */
  readonly update: ChartUpdate;
}): void {
  const { node, outgoing, before, shown, copy } = input;
  const old = shown.current;
  const fade = input.join?.crossfade ?? null;
  // The whole guard runs first, so the outgoing drawing, one clone per dot, is built only for a
  // crossfade that starts.
  const fades =
    input.cause === "commit" &&
    fade !== null &&
    fade !== old?.crossfade &&
    node !== null &&
    outgoing !== null &&
    before !== null &&
    old !== null &&
    !input.motion.snaps();
  const source = fades ? (copy.outgoing?.(old.node, before, input.update) ?? old.node) : null;
  if (fades && source !== null) {
    crossfade(node, outgoing, (drawing) => input.draw(drawing, old.look, before), source);
    // The path snapped, so a join lands on its rest, and anything else snaps.
    input.place(input.placement.kind === "join" ? input.placement : { kind: "snap" });
  } else input.place(input.placement);
  if (node === null) {
    shown.current = null;
    return;
  }
  // A step keeps a copy only while the mark holds none, as an active dot that first shows on a step.
  if (input.cause === "commit" || old === null) {
    shown.current = { node: copy.keep?.(node) ?? deepCopy(node), look: input.look, crossfade: fade };
  } else {
    copy.sync?.(old.node, node);
    shown.current = { ...old, crossfade: fade };
  }
}

/** A deep copy of a node, text included. */
function deepCopy(node: Element): Element {
  const copy = node.cloneNode(true);
  return copy instanceof Element ? copy : node;
}

/** Whether a copy is the same kind of element as the live node it copies. */
function sameKind<T extends Element>(copy: Element, live: T | null): copy is T {
  return live !== null && copy.constructor === live.constructor;
}

/**
 * How attached point marks reach a commit's geometry: they join what they sit on, and snap when
 * nothing they sit on moves, so a dot never tweens on a route of its own.
 */
function attachedPlacement(placement: Placement, join: FollowerJoin | undefined): Placement {
  return join === undefined && placement.kind === "move" ? { kind: "snap" } : placement;
}

/** An attached mark's registration, its outgoing element, and how it places. */
export type AttachedMark<T extends Element, A extends readonly ValueAxis[], O extends Element> = {
  /** Pass it as the live node's `ref`. */
  readonly ref: RefCallback<T>;
  /** The live node. */
  readonly node: () => T | null;
  /** Pass it as the `ref` of the empty element beside the live one, which the old drawing fades out in. */
  readonly outgoingRef: RefObject<O | null>;
  /**
   * The numbers the loop drew last for the mark: after `attach`, where what it joins placed it, such
   * as the point a decimated line passes at its slot, or a bar's far end.
   */
  readonly drawn: () => MarkValues | null;
  /**
   * Place the mark for a paint. It asks the commit classifier first, so the classifier sees every
   * commit, then places the target through what the mark joins, or stops for a null target, as a
   * mark that hides does.
   */
  readonly attach: (
    cause: FollowerCause,
    join: FollowerJoin | undefined,
    target: MarkTuple<A> | null
  ) => void;
};

/**
 * Register a mark that sits on a series' drawn point, as Dots, a Marker, the active dot and the
 * value followers do: its motion mark, its follower placement, the element its crossfade fades out
 * in and the copy it keeps for it.
 *
 * @param context - Root's context.
 * @param drawn - The frame the mark draws in, or null before the plot is measured.
 * @param draw - The mark's writer, bound at module scope in the mark's module.
 * @param look - The writer's look.
 * @param axes - What each of the mark's numbers measures.
 * @param options - Whether it is a point mark, which never tweens on a route of its own, and how
 *   it keeps its copy, on commit paints with a deep clone by default.
 * @returns The mark.
 */
export function useAttachedMark<
  T extends Element,
  L extends WriterLook<L>,
  const A extends readonly ValueAxis[],
  O extends Element = HTMLDivElement,
>(
  context: ChartRootContextValue,
  drawn: ChartFrame | null,
  draw: MotionWriter<T, L>,
  look: L,
  axes: A,
  options: { readonly point?: boolean; readonly copy?: AttachedCopy } = {}
): AttachedMark<T, A, O> {
  const { motion } = context;
  const mark = useMotionMark(motion, draw, look, axes);
  const placeFor = useFollowerPlacement(
    context.update,
    drawn?.plot ?? null,
    context.orientation,
    drawn?.frame ?? null
  );
  const outgoingRef = useRef<O>(null);
  const shown = useRef<AttachedShown<L> | null>(null);
  const { point = false, copy = COMMIT_COPY } = options;
  const attach = (
    cause: FollowerCause,
    joined: FollowerJoin | undefined,
    target: MarkTuple<A> | null
  ): void => {
    const asked = placeFor(cause, joined);
    if (target === null) return;
    const live = mark.node();
    placeAttached({
      motion,
      cause,
      join: joined,
      placement: point ? attachedPlacement(asked, joined) : asked,
      place: (placement) => mark.place(target, placement),
      node: live,
      outgoing: outgoingRef.current,
      before: mark.drawn(),
      look,
      shown,
      draw: (drawing, old, values) => {
        if (sameKind(drawing, live)) draw(drawing, old, values);
      },
      copy,
      update: context.update,
    });
  };
  return { ref: mark.ref, node: mark.node, outgoingRef, attach, drawn: mark.drawn };
}

/** The default copy: a deep clone, kept on commit paints. */
const COMMIT_COPY: AttachedCopy = {};

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
