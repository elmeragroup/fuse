"use client";

/**
 * Where a polar tooltip rests. The popup sits in a side lane beside the
 * dial, outside the labels past the rim and inside the Root's figure, centred on the active ray's
 * height at the rim, and Base UI keeps it inside the figure without changing its side. A step moves
 * it with the Root's angle follower: the popup rests at the target ray's height and shows the
 * follower's height through a vertical `translate`, so the popup, the hand and the dots move as one.
 * A change of lane fades the popup in over 120 ms instead of travelling, and so does a step that
 * leaps across the dial faster than the pointer's pace. A side lane takes the popup only when its
 * room holds the popup's content, so no value is cut; the positioner takes the lane's width, and
 * the popup fills it, so new text never makes Base UI place it again. A popup stays transparent until Base UI has placed it in its lane, so its first frame
 * never paints elsewhere. A pointer that moves toward the popup past the rim, inside the triangle
 * from where it left the plot to the popup's near edge, keeps the active part.
 */
import { use, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { writeStyle } from "./chart-dom";
import { PolarContext } from "./chart-polar-context";
import { useChartReadout } from "./chart-readout";
import type {
  AnchorInput,
  AnchorMeasure,
  ChartReadout,
  ClientPoint,
  TooltipAnchor,
} from "./chart-readout-port";
import { useChartStore } from "./chart-store";
import type { GlideRoute } from "./chart-tooltip-glide";
import {
  inTriangle,
  LANE_PAD,
  LANE_WIDEST,
  laneNeed,
  laneRest,
  laneSide,
  laneWidth,
  laneY,
  nearEdge,
} from "./layout/polar-lane";
import type { LaneBox, LaneDial, LaneSide } from "./layout/polar-lane";

const STRAIGHT: GlideRoute = { kind: "straight" };

/**
 * The labels a lane stays outside of, past the rim: angle, outside pie, Now, reference, value and
 * ring-value labels, such as a radar's "200" hanging below the rim at 6 o'clock.
 */
const LABELS =
  '[data-slot$="angle-label"], [data-slot="pie-chart-label"], [data-slot="clock-chart-now"] [data-part="label"], [data-slot$="value-label"], [data-slot$="reference-label"], [data-slot$="radius-label"]';

/**
 * The Root's own controls, which the bottom lane rests below and a side lane above, so the popup
 * never covers the control a pointer reaches for next.
 */
const CONTROLS =
  '[data-slot="chart-legend"], [data-slot="chart-legend-toggle-group"], [data-slot="chart-table-toggle"]';

/** How a lane switch fades the popup in. */
const LANE_FADE = { duration: 120, easing: "cubic-bezier(0.23, 1, 0.32, 1)" } as const;

/**
 * The opacity a lane change or a leap fades the popup in from: never blank, so the readout never
 * blinks out between two items.
 */
const LANE_FADE_FROM = 0.5;

/** The most frames a popup waits, transparent, for Base UI to place it in its lane. */
const PLACE_FRAMES = 6;

/** The popup inside a positioner. */
function popupOf(positioner: HTMLElement | null): HTMLElement | null {
  return positioner?.querySelector<HTMLElement>('[data-slot="chart-tooltip"]') ?? null;
}

/** One canvas the label measures share, made on first use. */
let measuring: CanvasRenderingContext2D | null | undefined;

/** The widest item label a readout prints in one font, measured once. */
type WidestLabel = { readonly readout: ChartReadout; readonly font: string; readonly text: string };

/**
 * The label any item prints that is widest in the popup's label font, measured once per readout and
 * font, or null for a popup with no label line.
 */
function widestLabel(
  label: HTMLElement,
  readout: ChartReadout,
  cache: { current: WidestLabel | null }
): string | null {
  if (readout.window === null) return null;
  if (measuring === undefined) measuring = document.createElement("canvas").getContext("2d");
  if (measuring === null) return null;
  const style = getComputedStyle(label);
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  if (cache.current?.readout !== readout || cache.current.font !== font) {
    measuring.font = font;
    let text = "";
    let width = -1;
    for (let index = readout.window.first; index <= readout.window.last; index += 1) {
      const next = readout.activeLabel(index, undefined);
      const measured = measuring.measureText(next).width;
      if (measured > width) {
        width = measured;
        text = next;
      }
    }
    cache.current = { readout, font, text };
  }
  return cache.current.text;
}

/**
 * The widest the popup's content will be on any step: its max-content width with the widest item
 * label in place of the current one, wherever the popup prints it, in the label line and in the rows
 * that name the item, each in its own font. A popup's lines are its item's label and rows that name
 * it, so its width follows the label, and a lane chosen for the widest label never has to change
 * for a longer one later. The text goes back before the measure returns, in the same task, so
 * nothing paints it and React's text nodes end as they were.
 *
 * @param popup - The popup.
 * @param readout - The Root's readout, whose items' labels the popup prints.
 * @param cache - The widest label measured last.
 * @returns The width in CSS pixels.
 */
function widestContent(
  popup: HTMLElement | null,
  readout: ChartReadout,
  cache: { current: WidestLabel | null }
): number {
  const label = popup?.querySelector<HTMLElement>('[data-slot="chart-tooltip-label"]');
  if (popup == null || label == null) return contentWidth(popup ?? null);
  const now = label.textContent;
  const widest = widestLabel(label, readout, cache);
  if (widest === null || widest === now || now === "") return contentWidth(popup);
  const swapped: Text[] = [];
  const walker = document.createTreeWalker(popup, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode())
    if (node instanceof Text && node.data === now) swapped.push(node);
  for (const node of swapped) node.data = widest;
  const width = contentWidth(popup);
  for (const node of swapped) node.data = now;
  return width;
}

/**
 * The popup's max-content width, its widest unwrapped line with its padding, measured by lifting its
 * width for one forced layout and putting it back.
 */
function contentWidth(popup: HTMLElement | null): number {
  if (popup === null) return 0;
  // The popup's own floor, its `min-width`, comes off too, so a narrow readout measures as narrow
  // and the lane's room is asked for what the text needs.
  const { width, maxWidth, minWidth } = popup.style;
  popup.style.setProperty("width", "max-content");
  popup.style.setProperty("max-width", "none");
  popup.style.setProperty("min-width", "0");
  // The used width, rounded up: offsetWidth rounds to the nearest pixel, and a lane cut to the
  // widest content wraps a label rounded down. The box's rect would carry the popup's entry
  // transform.
  const style = getComputedStyle(popup);
  const sides =
    style.boxSizing === "border-box"
      ? 0
      : Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight) +
        Number.parseFloat(style.borderLeftWidth) +
        Number.parseFloat(style.borderRightWidth);
  // A popup with no box, closed or not yet laid out, has no used width, only `max-content`, and
  // measures 0 as offsetWidth does.
  const used = Number.parseFloat(style.width);
  const measured = Number.isFinite(used) ? Math.ceil(used + sides - 0.001) : popup.offsetWidth;
  popup.style.setProperty("width", width);
  popup.style.setProperty("max-width", maxWidth);
  popup.style.setProperty("min-width", minWidth);
  return measured;
}

/**
 * The scene a lane reads, measured on resize ticks and never per pointer move, relative to the
 * dial's centre: the outer radius, a pie's popped slice included, the labels past the rim, the
 * Root's own controls, the figure's box, the viewport's bottom, the popup's size and its widest
 * content's max-content width.
 */
type Scene = {
  readonly radius: number;
  readonly labels: LaneBox | null;
  readonly controls: LaneBox | null;
  readonly bounds: LaneBox;
  readonly viewportBottom: number;
  readonly size: { readonly width: number; readonly height: number };
  readonly content: number;
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
  /** The box the popup's middle stays inside in its lane: the figure, less any controls below it. */
  readonly bounds: LaneBox;
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
  const { radius } = lane.scene;
  const { bounds } = lane;
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

/** The smallest box holding a box and another, or the box alone. */
function union(into: LaneBox | null, box: LaneBox): LaneBox {
  return into === null
    ? box
    : {
        left: Math.min(into.left, box.left),
        top: Math.min(into.top, box.top),
        right: Math.max(into.right, box.right),
        bottom: Math.max(into.bottom, box.bottom),
      };
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
  const readout = useChartReadout("Chart.Tooltip");
  const spread = useRef<WidestLabel | null>(null);
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
  // The widest content the popup has shown on this model, so a shorter readout never sends it back
  // to a lane a longer one left, and the lane never flips from step to step or between opens. It
  // resets when the model changes.
  const widest = useRef(0);
  useLayoutEffect(() => {
    widest.current = 0;
  }, [model]);
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
      // A pie's active slice pops out past the rim, so its side lane keeps its gap from the slice.
      const pop =
        model.drawing.kind === "pie"
          ? Number.parseFloat(getComputedStyle(figure).getPropertyValue("--chart-slice-pop")) || 0
          : 0;
      const radius = dial.scale + pop;
      let labels: LaneBox | null = null;
      for (const label of figure.querySelectorAll(LABELS)) {
        const rect = label.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const own = shifted(rect, -x, -y);
        if (!pastRim(own, dial.scale)) continue;
        labels = union(labels, own);
      }
      let controls: LaneBox | null = null;
      for (const control of figure.querySelectorAll(CONTROLS)) {
        const rect = control.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        controls = union(controls, shifted(rect, -x, -y));
      }
      const size = { width: node?.offsetWidth ?? 0, height: node?.offsetHeight ?? 0 };
      const popup = popupOf(node);
      widest.current = Math.max(widest.current, widestContent(popup, readout, spread));
      const content = widest.current;
      setScene({
        radius,
        labels,
        controls,
        bounds: shifted(figure.getBoundingClientRect(), -x, -y),
        viewportBottom: window.innerHeight - y,
        size,
        content,
      });
    };
    measure();
    const sizes = new ResizeObserver(measure);
    const figure = kernel.root();
    if (figure !== null) sizes.observe(figure);
    if (positioner.current !== null) sizes.observe(positioner.current);
    return () => {
      sizes.disconnect();
    };
  }, [open, measures, dialOf, kernel, positioner, readout, model]);
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
      : laneRest({
          angle,
          side: preferred,
          dial: origin,
          labels: scene.labels,
          controls: scene.controls,
          size: scene.size,
          bounds: scene.bounds,
          content: scene.content,
          viewportBottom: scene.viewportBottom,
        });
  // A closing popup keeps the lane it showed in while it fades out.
  const [shownSide, setShownSide] = useState<LaneSide>("right");
  if (placed !== null && placed.side !== shownSide) setShownSide(placed.side);
  const side: LaneSide = placed?.side ?? shownSide;
  const room = placed?.room ?? null;
  // The popup's one width in its lane, and the lowest its middle may ride, kept as numbers so the
  // effects below run when they change and not on every render.
  const width = placed === null ? null : placed.box.right - placed.box.left;
  const floor = placed?.bounds.bottom ?? null;
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
  // Where Base UI should put the positioner's near edge, in client pixels, read by the check that
  // keeps a newly opened popup transparent until it is there.
  const corner = useRef<{ readonly side: LaneSide; readonly x: number; readonly y: number } | null>(null);
  useLayoutEffect(() => {
    corner.current = anchorX === null || anchorY === null ? null : { side, x: anchorX, y: anchorY };
  }, [side, anchorX, anchorY]);
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
  const placing = useRef<number | null>(null);
  useLayoutEffect(
    () => () => {
      if (sizing.current !== null) cancelAnimationFrame(sizing.current);
      if (placing.current !== null) cancelAnimationFrame(placing.current);
    },
    []
  );
  /**
   * Whether Base UI has put the positioner's near edge on the lane's corner: a side lane's inner edge,
   * or the bottom lane's top, within a pixel.
   */
  const onLane = useCallback((): boolean => {
    const node = positioner.current;
    const want = corner.current;
    const dial = dialOf();
    if (node === null || want === null || dial === null) return false;
    const rect = node.getBoundingClientRect();
    const at =
      want.side === "right"
        ? rect.left - (dial.centre.x + want.x)
        : want.side === "left"
          ? rect.right - (dial.centre.x + want.x)
          : rect.top - (dial.centre.y + want.y);
    return Math.abs(at) <= 1;
  }, [positioner, dialOf]);
  useLayoutEffect(() => {
    // A closing popup keeps its place, its width and its lane while it fades out.
    if (angle === null) {
      before.current = null;
      return;
    }
    // A change of lane fades the popup in where it rests, instead of carrying it across the dial, and
    // it holds there until the next step. So does a step that leaps across the dial, which holds
    // there until the follower stops leaping.
    const was = before.current;
    before.current = side;
    const opening = was === null;
    const switched = was !== null && was !== side;
    const last = lane.current;
    // Only a side lane's popup rides the follower, so only there does a leap fade it in; the bottom
    // lane's never moves, and its content swaps in place.
    const leaped =
      turns && side !== "bottom" && (last === null || last.angle !== angle) && kernel.follow.leaps();
    const holds =
      switched || leaped || (last !== null && last.holds && (last.angle === angle || kernel.follow.leaps()));
    if (scene !== null)
      lane.current = {
        angle,
        side,
        scene,
        bounds: floor === null ? scene.bounds : { ...scene.bounds, bottom: floor },
        holds,
        turns,
        size: lane.current?.size ?? scene.size,
      };
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
      // Content wider than any the popup has shown widens it once, and content that outgrows its
      // side lane sends it to a lane that holds it.
      const popup = popupOf(node);
      widest.current = Math.max(widest.current, widestContent(popup, readout, spread));
      const content = widest.current;
      const outgrows = now.side !== "bottom" && room !== null && laneNeed(content + LANE_PAD) > room;
      // A row wider than any the popup has shown widens it before this frame paints, so the row
      // never wraps for a frame while the scene catches up.
      if (room !== null && width !== null && content > width)
        writeStyle(
          node,
          "width",
          `${laneWidth(room, content, now.side === "bottom" ? room : LANE_WIDEST).toFixed(2)}px`
        );
      if (outgrows || (width !== null && content > width))
        setScene((last) => (last === null || last.content >= content ? last : { ...last, content }));
    });
    const node = positioner.current;
    const popup = popupOf(node);
    // The positioner takes the popup's one width in its lane, its widest content within the room,
    // and the popup fills it, so new text never changes its width, its edges never move from step
    // to step, and Base UI never moves it a frame later; a label longer than the lane wraps. A
    // closing popup keeps the width it showed.
    if (node !== null && width !== null) writeStyle(node, "width", `${width.toFixed(2)}px`);
    if ((switched || leaped) && popup !== null && !motion.reduced()) {
      popup.animate([{ opacity: LANE_FADE_FROM }, { opacity: 1 }], LANE_FADE);
    }
    // A popup that opens stays transparent, and lets the pointer through, until Base UI has placed
    // it in its lane, so its first frame never paints or takes the pointer elsewhere. It shows only
    // once an item has been active in the Root's store at two frame checks in a row: the store is the
    // live state the pick writes, but a flick's close can land after the check in the frame after
    // the open, so one check is not enough. A popup shows once its item has survived a full frame,
    // at most a frame later than it would have; a popup that follows the pointer on to another item
    // is still open, and shows.
    if (opening && popup !== null && placing.current === null) {
      writeStyle(popup, "opacity", "0");
      writeStyle(popup, "pointer-events", "none");
      let frames = 0;
      let survived = 0;
      const check = (): void => {
        frames += 1;
        // A popup whose item closed during the hold was never shown, so it stays transparent and
        // only lets the pointer through again; the next open's hold writes both.
        if (kernel.store.get().active === null) {
          placing.current = null;
          writeStyle(popup, "pointer-events", null);
          return;
        }
        survived += 1;
        if (survived >= 2 && (onLane() || frames >= PLACE_FRAMES)) {
          placing.current = null;
          writeStyle(popup, "opacity", null);
          writeStyle(popup, "pointer-events", null);
          return;
        }
        placing.current = requestAnimationFrame(check);
      };
      placing.current = requestAnimationFrame(check);
    }
  }, [
    angle,
    side,
    room,
    width,
    floor,
    scene,
    turns,
    kernel.follow,
    kernel.store,
    positioner,
    motion,
    onLane,
    readout,
  ]);
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
