"use client";

/**
 * The tooltip's glide between slots. Base UI places the popup by writing `translate(x, y)` to the
 * positioner's inline style. A slot step arms the glider, and the next place Base UI writes plays
 * as one Web Animation of the positioner's transform from where the popup shows, over the chart's
 * `--chart-glide` on bklit's tooltip spring, stiffness 100 and damping 20, which never overshoots.
 * A popup resting over a vertical plot glides along `glidePath`, so it clears every mark on the
 * way, and moves at once when that path would leave the viewport, as it would from the fallback
 * that overlays the plot. Anything else that moves the popup, such as a scroll, a resize of the
 * window, a data update or a change of side, stops the glide, and the popup shows Base UI's place
 * at once. The positioner portals out of the chart, so the glider copies the chart's duration onto
 * it. The stylesheet sets `--_glide` from it only while the reader has no preference for reduced
 * motion, so under reduced motion every place shows at once.
 */
import { writeStyle } from "./chart-dom";
import { springTiming } from "./chart-spring";
import { TOOLTIP_EDGE, glidePath } from "./layout/tooltip-place";
import type { PlaceSize, PopupPlace } from "./layout/tooltip-place";

/** The roof over a span of client pixels, as a client y, or null where no mark reaches into it. */
export type ClientRoof = (left: number, right: number) => number | null;

/**
 * How a step's glide travels. "roof" glides along `glidePath` over the roof the popup rests on, and
 * shows the next place at once when that path would leave the viewport. "straight" glides in a
 * line, as along the plot's top lane or a horizontal chart's rows.
 */
export type GlideRoute = { readonly kind: "roof"; readonly roof: ClientRoof } | { readonly kind: "straight" };

/**
 * Glides the popup's positioner to the places Base UI writes after a slot step.
 */
export type TooltipGlider = {
  /**
   * Glide to the place Base UI writes for this step, from where the popup shows now. `route` reads,
   * at that place, how the glide travels. A route over the roof glides straight once the popup
   * leaves the top side, and jumps when its path would leave the viewport. The arming lasts for the
   * step's own placement: a step that moves the popup nowhere spends it by the next frame.
   */
  readonly arm: (route: () => GlideRoute) => void;
  /** End any glide at once, so the popup shows Base UI's last place. */
  readonly stop: () => void;
  /** Stop watching the positioner. */
  readonly dispose: () => void;
};

/** A translation in the positioner's own pixels. */
type Shift = { readonly x: number; readonly y: number };

/** What a step armed: the side the popup was on, and how the glide travels. */
type Armed = {
  readonly side: string | null;
  readonly route: () => GlideRoute;
};

const TRANSLATE = /translate\(\s*(-?[\d.e+-]+)px\s*,\s*(-?[\d.e+-]+)px\s*\)/;

/**
 * Glide a positioner after slot steps.
 *
 * @param positioner - The tooltip's positioner.
 * @param chart - The chart Root's element, whose glide duration the positioner takes.
 * @returns The glider.
 */
export function createTooltipGlider(positioner: HTMLElement, chart: HTMLElement | null): TooltipGlider {
  takeDuration(positioner, chart);
  let armed: Armed | null = null;
  let running: Animation | null = null;
  // Where Base UI last placed the positioner, and its size there, which a glide starts from when
  // none runs.
  let placed = writtenShift(positioner);
  let placedSize = { width: positioner.offsetWidth, height: positioner.offsetHeight };
  const stop = () => {
    armed = null;
    running?.cancel();
    running = null;
  };
  const written = new MutationObserver(() => {
    const target = writtenShift(positioner);
    if (target === null || (placed !== null && target.x === placed.x && target.y === placed.y)) return;
    const size = { width: positioner.offsetWidth, height: positioner.offsetHeight };
    // Where the popup shows, at its new size with the edge that faces the plot kept where it was,
    // so new content that makes it larger grows it away from the marks.
    const shown = running === null ? placed : shownShift(positioner);
    const from =
      shown === null ? null : facingKept(shown, placedSize, size, positioner.getAttribute("data-side"));
    placed = target;
    placedSize = size;
    // A place Base UI writes after the glide ended, or on another side, shows at once.
    if (armed === null || from === null || positioner.getAttribute("data-side") !== armed.side) {
      stop();
      return;
    }
    const timing = glideTiming(positioner);
    const keyframes = timing === null ? null : glideKeyframes(positioner, from, target, armed);
    if (timing === null || keyframes === null) {
      stop();
      return;
    }
    const previous = running;
    running = positioner.animate(keyframes, timing);
    // The new glide covers the old one from its first frame, so the old one ends without a jump.
    previous?.cancel();
    const own = running;
    own.onfinish = () => {
      if (running !== own) return;
      running = null;
      armed = null;
    };
  });
  written.observe(positioner, { attributes: true, attributeFilter: ["style"] });
  const view = positioner.ownerDocument.defaultView;
  view?.addEventListener("scroll", stop, { capture: true, passive: true });
  view?.addEventListener("resize", stop, { passive: true });
  return {
    arm: (route) => {
      const own = { side: positioner.getAttribute("data-side"), route };
      armed = own;
      // Base UI writes the step's place before the next frame. A step whose place moves nothing
      // starts no glide, and its arming ends there, so a later placement shows at once.
      view?.requestAnimationFrame(() => {
        if (armed === own && running === null) armed = null;
      });
    },
    stop,
    dispose: () => {
      written.disconnect();
      view?.removeEventListener("scroll", stop, { capture: true });
      view?.removeEventListener("resize", stop);
      stop();
    },
  };
}

/**
 * A translation moved so a box that changed size keeps the edge that faces the plot: its bottom
 * edge above the plot, its top edge below it, and its inner edge beside it.
 */
function facingKept(shift: Shift, before: PlaceSize, after: PlaceSize, side: string | null): Shift {
  if (side === "top") return { x: shift.x, y: shift.y + before.height - after.height };
  if (side === "left") return { x: shift.x + before.width - after.width, y: shift.y };
  return shift;
}

/** Copy the chart's glide duration onto the positioner. */
function takeDuration(positioner: HTMLElement, chart: HTMLElement | null): void {
  if (chart === null) return;
  const tokens = getComputedStyle(chart);
  const value = tokens.getPropertyValue("--chart-glide");
  writeStyle(positioner, "--chart-glide", value === "" ? null : value);
}

/** The translation Base UI wrote to the positioner's inline style, or null before it placed it. */
function writtenShift(positioner: HTMLElement): Shift | null {
  const match = TRANSLATE.exec(positioner.style.transform);
  return match === null ? null : { x: Number(match[1]), y: Number(match[2]) };
}

/** The translation the positioner shows now, a running glide's frame included. */
function shownShift(positioner: HTMLElement): Shift | null {
  const transform = getComputedStyle(positioner).transform;
  if (transform === "none" || transform === "") return null;
  const matrix = new DOMMatrixReadOnly(transform);
  return { x: matrix.e, y: matrix.f };
}

/**
 * The glide's duration and the tooltip spring's curve, or null when it does not run: under reduced
 * motion, where the stylesheet leaves `--_glide` unset, or for a duration of zero.
 */
function glideTiming(positioner: HTMLElement): KeyframeAnimationOptions | null {
  const style = getComputedStyle(positioner);
  const duration = milliseconds(style.getPropertyValue("--_glide"));
  if (duration === null || duration <= 0) return null;
  return { duration, easing: springTiming("glide").easing };
}

/** A CSS time in milliseconds, or null for anything else. */
function milliseconds(value: string): number | null {
  const match = /^\s*(-?[\d.]+(?:e[-+]?\d+)?)(ms|s)\s*$/i.exec(value);
  if (match === null) return null;
  const amount = Number(match[1]);
  return match[2]?.toLowerCase() === "s" ? amount * 1000 : amount;
}

/**
 * The keyframes from one translation to the next, evenly paced along the glide's path, or null when
 * the popup moves at once. Over the roof the path turns where `glidePath` turns it, measured in
 * client pixels from the positioner's box and taken back into the positioner's own pixels. Only a
 * popup on the top side rests on the roof, so on any other side the glide runs straight.
 */
function glideKeyframes(positioner: HTMLElement, from: Shift, to: Shift, armed: Armed): Keyframe[] | null {
  const straight: Keyframe[] = [{ transform: translate(from) }, { transform: translate(to) }];
  const route = armed.route();
  if (route.kind === "straight" || armed.side !== "top") return straight;
  // The positioner's box at the target, which is where Base UI's translation puts it.
  const shownBox = positioner.getBoundingClientRect();
  const shown = animated(positioner) ? shownShift(positioner) : to;
  if (shown === null) return straight;
  const scale = positionerScale(positioner);
  const end: PopupPlace = {
    left: shownBox.left + (to.x - shown.x) * scale,
    bottom: shownBox.bottom + (to.y - shown.y) * scale,
  };
  const start: PopupPlace = {
    left: end.left + (from.x - to.x) * scale,
    bottom: end.bottom + (from.y - to.y) * scale,
  };
  const size = { width: shownBox.width, height: shownBox.height };
  const turns = glidePath(start, end, size, route.roof, TOOLTIP_EDGE);
  if (turns === null) return null;
  const lengths = turns.map((turn, index) => {
    const before = turns[index - 1];
    return before === undefined ? 0 : Math.hypot(turn.left - before.left, turn.bottom - before.bottom);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return straight;
  let travelled = 0;
  return turns.map((turn, index) => {
    travelled += lengths[index] ?? 0;
    return {
      transform: translate({
        x: from.x + (turn.left - start.left) / scale,
        y: from.y + (turn.bottom - start.bottom) / scale,
      }),
      offset: travelled / total,
    };
  });
}

/**
 * How many client pixels one of the positioner's own pixels spans. Base UI writes the positioner's
 * place and applies its offsets in its own pixels, which a scaled ancestor of the portal scales.
 *
 * @param positioner - The tooltip's positioner.
 * @returns The scale, 1 when nothing scales the positioner.
 */
export function positionerScale(positioner: HTMLElement): number {
  const width = positioner.offsetWidth;
  return width === 0 ? 1 : positioner.getBoundingClientRect().width / width;
}

/** Whether an animation drives the positioner's transform now. */
function animated(positioner: HTMLElement): boolean {
  return positioner.getAnimations().some((animation) => animation.playState === "running");
}

function translate({ x, y }: Shift): string {
  return `translate(${String(x)}px, ${String(y)}px)`;
}
