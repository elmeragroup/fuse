"use client";

/**
 * Where a polar tooltip rests (MOTION-REVIEW Fix R2, Q9). The popup sits in a side lane beside the
 * dial, outside the labels past the rim and inside the Root's figure, centred on the active ray's
 * height at the rim, and Base UI keeps it inside the figure without changing its side. A step moves
 * it with the Root's angle follower: the popup rests at the target ray's height and shows the
 * follower's height through a vertical `translate`, so the popup, the hand and the dots move as one.
 * A change of lane fades the popup in over 120 ms instead of travelling. A pointer that moves toward
 * the popup past the rim, inside the triangle from where it left the plot to the popup's near edge,
 * keeps the active part.
 */
import { use, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { writeStyle } from "./chart-dom";
import { PolarContext } from "./chart-polar-context";
import type { AnchorInput, AnchorMeasure, ClientPoint, TooltipAnchor } from "./chart-readout-port";
import { useChartStore } from "./chart-store";
import type { GlideRoute } from "./chart-tooltip-glide";
import { inTriangle, laneRest, laneSide, laneY, nearEdge } from "./layout/polar-lane";
import type { LaneBox, LaneDial, LaneSide } from "./layout/polar-lane";

const STRAIGHT: GlideRoute = { kind: "straight" };

/** The labels a lane stays outside of, past the rim: angle, outside pie, Now, reference and ring-value labels. */
const LABELS =
  '[data-slot$="angle-label"], [data-slot="pie-chart-label"], [data-slot="clock-chart-now"] [data-part="label"], [data-slot$="value-label"], [data-slot$="reference-label"]';

/** The widest a side lane's popup grows, in CSS pixels, 16rem. */
const LANE_WIDEST = 256;

/** How a lane switch fades the popup in. */
const LANE_FADE = { duration: 120, easing: "cubic-bezier(0.23, 1, 0.32, 1)" } as const;

/**
 * The scene a lane reads, measured on resize ticks and never per pointer move, relative to the
 * dial's centre: the outer radius, the labels past the rim, the figure's box and the popup's size.
 */
type Scene = {
  readonly radius: number;
  readonly labels: LaneBox | null;
  readonly bounds: LaneBox;
  readonly size: { readonly width: number; readonly height: number };
};

/**
 * The lane the popup rests in: the target ray's angle, its side, the scene it was placed in, and
 * whether it holds the target's height, as it does from a lane switch to the next step, since a
 * switch fades the popup in where it rests instead of carrying it there.
 */
type LaneNow = {
  readonly angle: number;
  readonly side: LaneSide;
  readonly scene: Scene;
  readonly holds: boolean;
  /** Whether the popup rides the ray's height at all, as a clock's and a radar's do. */
  readonly turns: boolean;
  /**
   * The popup's size, read once per step in that frame's animation callback, when its content has
   * changed, and reused on every other frame of the glide, so no frame forces a style or layout.
   */
  readonly size: { readonly width: number; readonly height: number };
};

/**
 * Place the popup in its lane. Base UI puts the popup's corner at the lane's anchor: a side lane's top
 * at the dial's height, the bottom lane's left at the figure's left. The positioner's own
 * `translate`, which composes with the `transform` Base UI writes and which no open or close
 * animation touches, then centres it by its own size in CSS, so new text keeps it centred in the
 * same frame: a side lane's popup on the height of the ray at the follower's angle, so it moves with
 * the hand and the dots, and the bottom lane's on the dial, each clamped into the figure by the size
 * measured last. A pie's or a radial chart's side lane rests at the dial's height. Reduced motion
 * snaps the follower, so the popup shows the target's height at once.
 */
function shiftPopup(positioner: HTMLElement | null, lane: LaneNow | null, shown: number | null): void {
  if (positioner === null || lane === null) return;
  const { bounds, radius } = lane.scene;
  const { width, height } = lane.size;
  if (lane.side === "bottom") {
    // Centred on the dial by its own width in CSS, so a change of text keeps it centred in the same
    // frame; clamped to the figure's edge by the width measured last.
    const left = Math.min(bounds.right - width, Math.max(bounds.left, -width / 2));
    const x =
      left === -width / 2
        ? `calc(${(-bounds.left).toFixed(2)}px - 50%)`
        : `${(left - bounds.left).toFixed(2)}px`;
    writeStyle(positioner, "translate", `${x} 0px`);
    return;
  }
  const dial = { centre: { x: 0, y: 0 }, radius };
  const angle = !lane.turns ? 90 : lane.holds ? lane.angle : (shown ?? lane.angle);
  const middle = laneY(angle, dial, height, bounds);
  // Centred on the ray's height by its own height in CSS, so a change of text keeps it centred in
  // the same frame; clamped into the figure by the height measured last.
  writeStyle(positioner, "translate", `0px calc(${middle.toFixed(2)}px - 50%)`);
}

/** A box moved by an offset. */
function shifted(box: LaneBox, x: number, y: number): LaneBox {
  return { left: box.left + x, top: box.top + y, right: box.right + x, bottom: box.bottom + y };
}

/** Whether a box reaches past a circle about the origin. */
function pastRim(box: LaneBox, radius: number): boolean {
  return [box.left, box.right].some((x) => [box.top, box.bottom].some((y) => Math.hypot(x, y) > radius));
}

/**
 * A polar Root's tooltip anchor in a side lane.
 *
 * @param input - The tooltip's active option, positioner and measure count.
 * @returns The anchor.
 */
export function usePolarTooltipAnchor(input: AnchorInput): TooltipAnchor {
  const polar = use(PolarContext);
  if (polar === null)
    throw new Error("A polar Tooltip renders inside its polar Root, which provides the context.");
  const { model, kernel, box, motion } = polar;
  const { active, positioner, measures } = input;
  const near = useChartStore(kernel.store, (snapshot) => snapshot.near);
  const ray = active === null ? null : model.ray(active, near);
  const angle = ray?.angle ?? null;
  const surfaceOf = useCallback(() => document.getElementById(`${kernel.id}-surface`), [kernel.id]);
  /** The dial's centre and CSS pixels per unit of the outer radius, in client pixels. */
  const dialOf = useCallback((): { readonly centre: ClientPoint; readonly scale: number } | null => {
    const rect = surfaceOf()?.getBoundingClientRect();
    const width = box.right - box.left;
    if (rect === undefined || !(width > 0)) return null;
    const scale = rect.width / width;
    return { centre: { x: rect.left - box.left * scale, y: rect.top - box.top * scale }, scale };
  }, [surfaceOf, box]);
  const [scene, setScene] = useState<Scene | null>(null);
  const open = angle !== null;
  // The scene is measured when the popup opens, on every measure tick and whenever the figure or
  // the popup changes size.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = (): void => {
      const dial = dialOf();
      const figure = kernel.root();
      const node = positioner.current;
      if (dial === null || figure === null) return;
      const { x, y } = dial.centre;
      const radius = dial.scale;
      let labels: LaneBox | null = null;
      for (const label of figure.querySelectorAll(LABELS)) {
        const rect = label.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const own = shifted(rect, -x, -y);
        if (!pastRim(own, radius)) continue;
        labels =
          labels === null
            ? own
            : {
                left: Math.min(labels.left, own.left),
                top: Math.min(labels.top, own.top),
                right: Math.max(labels.right, own.right),
                bottom: Math.max(labels.bottom, own.bottom),
              };
      }
      const size = { width: node?.offsetWidth ?? 0, height: node?.offsetHeight ?? 0 };
      setScene({ radius, labels, bounds: shifted(figure.getBoundingClientRect(), -x, -y), size });
    };
    measure();
    const sizes = new ResizeObserver(measure);
    const figure = kernel.root();
    if (figure !== null) sizes.observe(figure);
    if (positioner.current !== null) sizes.observe(positioner.current);
    return () => {
      sizes.disconnect();
    };
  }, [open, measures, dialOf, kernel, positioner]);
  // The lane the popup is in, kept across steps until the ray turns 20° into the other half.
  // A radial chart's ray is a ring's value end, which jumps between unrelated angles as the pointer
  // crosses rings, so its popup keeps the lane it opened in until it closes. A pie's or a radial
  // chart's ray steps from one slice or ring to another rather than turning with the pointer, so
  // their popups rest at the dial's height in their lane, a readout beside the dial, instead of
  // sweeping the lane on every step; a clock's and a radar's turn with the hand.
  const keepsLane = model.drawing.kind === "radial";
  const turns = model.drawing.kind === "clock" || model.drawing.kind === "radar";
  const [held, setHeld] = useState<"right" | "left" | null>(null);
  const preferred = angle === null ? null : keepsLane && held !== null ? held : laneSide(angle, held);
  // The lane outlives a close, so a popup that reopens a moment later, as a pointer crosses from one
  // ring or slice to the next, takes the same side.
  if (preferred !== null && preferred !== held) setHeld(preferred);
  const origin: LaneDial | null =
    scene === null
      ? null
      : { centre: { x: 0, y: 0 }, radius: scene.radius, bottom: box.bottom * scene.radius };
  const placed =
    angle === null || preferred === null || scene === null || origin === null
      ? null
      : laneRest(angle, preferred, origin, scene.labels, scene.size, scene.bounds);
  // A closing popup keeps the lane it showed in while it fades out.
  const [shownSide, setShownSide] = useState<LaneSide>("right");
  if (placed !== null && placed.side !== shownSide) setShownSide(placed.side);
  const side: LaneSide = placed?.side ?? shownSide;
  const room = placed?.room ?? null;
  // The anchor is the lane's corner, relative to the dial's centre: a side lane's inner edge at the
  // dial's own height, or the bottom lane's top at the figure's left. It never moves on a step, so
  // Base UI places the popup again only when its lane changes, and `shiftPopup` places it within.
  const anchorX =
    placed === null
      ? null
      : placed.side === "right"
        ? placed.box.left
        : placed.side === "left"
          ? placed.box.right
          : (scene?.bounds.left ?? 0);
  const anchorY = placed === null ? null : placed.side === "bottom" ? placed.box.top : 0;
  const virtual = useMemo(() => {
    if (anchorX === null || anchorY === null) return null;
    const measure = (): AnchorMeasure => {
      const dial = dialOf();
      if (dial === null) return { box: new DOMRect(), shift: 0, route: STRAIGHT };
      return {
        box: new DOMRect(dial.centre.x + anchorX, dial.centre.y + anchorY, 0, 0),
        shift: 0,
        route: STRAIGHT,
      };
    };
    let latest: AnchorMeasure | null = null;
    return {
      getBoundingClientRect: () => {
        latest = measure();
        return latest.box;
      },
      get contextElement() {
        return surfaceOf() ?? undefined;
      },
      placed: () => latest ?? measure(),
    };
  }, [anchorX, anchorY, dialOf, surfaceOf]);
  // The follower's angle, shown as the popup's vertical offset from the target ray's height.
  const lane = useRef<LaneNow | null>(null);
  const before = useRef<LaneSide | null>(null);
  const sizing = useRef<number | null>(null);
  useLayoutEffect(
    () => () => {
      if (sizing.current !== null) cancelAnimationFrame(sizing.current);
    },
    []
  );
  useLayoutEffect(() => {
    // A closing popup keeps its place, its width and its lane while it fades out.
    if (angle === null) {
      before.current = null;
      return;
    }
    // A change of lane fades the popup in where it rests, instead of carrying it across the dial, and
    // it holds there until the next step.
    const was = before.current;
    before.current = side;
    const switched = was !== null && was !== side;
    const last = lane.current;
    const holds = switched || (last !== null && last.holds && last.angle === angle);
    if (scene !== null)
      lane.current = { angle, side, scene, holds, turns, size: lane.current?.size ?? scene.size };
    shiftPopup(positioner.current, lane.current, kernel.follow.shown());
    // The step's new content is measured in this frame's animation callback, before it paints, with
    // the frame's own style pass instead of a forced one in the pointer's event.
    sizing.current ??= requestAnimationFrame(() => {
      sizing.current = null;
      const node = positioner.current;
      const now = lane.current;
      if (node === null || now === null) return;
      lane.current = { ...now, size: { width: node.offsetWidth, height: node.offsetHeight } };
      shiftPopup(node, lane.current, kernel.follow.shown());
    });
    // The popup takes its lane's room as its widest, so a long label wraps instead of moving it.
    const popup = positioner.current?.querySelector<HTMLElement>('[data-slot="chart-tooltip"]');
    // A side lane's popup takes a fixed width, its lane's room up to 16rem, so new text never changes
    // its width and Base UI never moves it a frame later; the bottom lane's takes the room as its
    // widest. A closing popup keeps the width it showed.
    if (popup != null && room !== null) {
      const fixed = side === "bottom" ? null : `${Math.min(room, LANE_WIDEST).toFixed(2)}px`;
      writeStyle(popup, "width", fixed);
      writeStyle(popup, "max-width", `${room.toFixed(2)}px`);
    }
    if (switched && popup != null && !motion.reduced()) {
      popup.animate([{ opacity: 0 }, { opacity: 1 }], LANE_FADE);
    }
  }, [angle, side, room, scene, turns, kernel.follow, positioner, motion]);
  useLayoutEffect(
    () =>
      kernel.follow.subscribe((shown) => {
        shiftPopup(positioner.current, lane.current, shown);
      }),
    [kernel.follow, positioner]
  );
  // New data moves the popup at once.
  const revision = useMemo(() => ({ model }), [model]);
  const forget = useCallback(() => undefined, []);
  const watch = useCallback(() => undefined, []);
  const freezes = (from: ClientPoint, to: ClientPoint): boolean => {
    const node = positioner.current;
    if (node === null) return false;
    const rect = node.getBoundingClientRect();
    const [a, b] = nearEdge(from, rect);
    return inTriangle(to, from, a, b);
  };
  return {
    virtual,
    side,
    bridge: false,
    revision,
    forget,
    watch,
    freezes,
    sideOffset: () => 0,
    alignOffset: () => 0,
  };
}
