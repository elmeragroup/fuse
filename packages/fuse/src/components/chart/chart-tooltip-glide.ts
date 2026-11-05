"use client";

/**
 * The tooltip's glide between slots. Base UI places the popup by writing `translate(x, y)` to the
 * positioner's inline style. A slot step arms the glider, and the next place Base UI writes plays
 * as one Web Animation of the positioner's transform from where the popup shows, over the chart's
 * `--chart-glide` on the tooltip spring, stiffness 100 and damping 20, which never overshoots. A
 * route that follows a path, such as the cartesian popup's way over the marks it rests on, turns
 * where the route says, and moves the popup at once where the route finds no way, as it does when
 * the way would leave the viewport. Anything else that moves the popup, such as a scroll, a resize
 * of the window, a data update or a change of side, stops the glide, and the popup shows Base UI's
 * place at once. The positioner portals out of the chart, so the glider copies the chart's duration
 * onto it. The stylesheet sets `--_glide` from it only while the reader has no preference for
 * reduced motion, so under reduced motion every place shows at once.
 */
import { clientScale, writeStyle } from "./chart-dom";
import { springTiming } from "./chart-spring";
import { CHART_SPRINGS } from "./layout/motion";
import type { PlaceSize, PopupPlace } from "./layout/tooltip-place";

/**
 * The turns of a glide from one popup place to the next, in client pixels, the start and the end
 * included, or null when the popup should move at once.
 */
export type GlideTurns = (
  from: PopupPlace,
  to: PopupPlace,
  size: PlaceSize,
  side: string | null
) => readonly PopupPlace[] | null;

/**
 * How a step's glide travels. "path" glides through the turns its family's route gives for the side
 * the popup is on, and shows the next place at once when the route gives none. Its `keeps` names
 * what the glide holds still: "side", as over the cartesian roof, where a place on another side
 * shows at once and a popup that changes size keeps the edge that faces the plot, or "centre", as
 * round a polar dial, where the popup may change side on its way and keeps its centre on the ray.
 * "straight" glides in a line, as along the plot's top lane or a horizontal chart's rows.
 */
export type GlideRoute =
  | { readonly kind: "path"; readonly keeps: "side" | "centre"; readonly turns: GlideTurns }
  | { readonly kind: "straight" };

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
    const before = placedSize;
    placed = target;
    placedSize = size;
    // A place Base UI writes after the glide ended shows at once.
    if (armed === null || shown === null) {
      stop();
      return;
    }
    const side = positioner.getAttribute("data-side");
    const route = armed.route();
    const centred = route.kind === "path" && route.keeps === "centre";
    // A place on another side shows at once, unless the route keeps the popup's centre.
    if (!centred && side !== armed.side) {
      stop();
      return;
    }
    const from = centred ? centreKept(shown, before, size) : facingKept(shown, before, size, side);
    const timing = glideTiming(positioner);
    const keyframes = timing === null ? null : glideKeyframes(positioner, from, target, armed.side, route);
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

/** A translation moved so a box that changed size keeps its centre where it was. */
function centreKept(shift: Shift, before: PlaceSize, after: PlaceSize): Shift {
  return { x: shift.x + (before.width - after.width) / 2, y: shift.y + (before.height - after.height) / 2 };
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
  return { duration, easing: springTiming(CHART_SPRINGS.glide).easing };
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
 * the popup moves at once. A path turns where its route turns it, measured in client pixels from
 * the positioner's box and taken back into the positioner's own pixels.
 */
function glideKeyframes(
  positioner: HTMLElement,
  from: Shift,
  to: Shift,
  side: string | null,
  route: GlideRoute
): Keyframe[] | null {
  const straight: Keyframe[] = [{ transform: translate(from) }, { transform: translate(to) }];
  if (route.kind === "straight") return straight;
  // The positioner's box at the target, which is where Base UI's translation puts it.
  const shownBox = positioner.getBoundingClientRect();
  const shown = animated(positioner) ? shownShift(positioner) : to;
  if (shown === null) return straight;
  // Base UI writes the positioner's place and applies its offsets in its own pixels, which a scaled
  // ancestor of the portal scales.
  const scale = clientScale(positioner).x;
  const end: PopupPlace = {
    left: shownBox.left + (to.x - shown.x) * scale,
    bottom: shownBox.bottom + (to.y - shown.y) * scale,
  };
  const start: PopupPlace = {
    left: end.left + (from.x - to.x) * scale,
    bottom: end.bottom + (from.y - to.y) * scale,
  };
  const size = { width: shownBox.width, height: shownBox.height };
  const turns = route.turns(start, end, size, side);
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

/** Whether an animation drives the positioner's transform now. */
function animated(positioner: HTMLElement): boolean {
  return positioner.getAnimations().some((animation) => animation.playState === "running");
}

function translate({ x, y }: Shift): string {
  return `translate(${String(x)}px, ${String(y)}px)`;
}
