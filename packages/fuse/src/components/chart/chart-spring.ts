"use client";

/**
 * The pointer-following glides on bklit's springs. A follower writes its mark's resting geometry at
 * once, so every attribute and every reader sees the active slot, and `glideFrom` plays a Web
 * Animation of `translate` from where the mark shows back to none. A step mid-glide replaces the
 * running glide with one from the offset it shows now, which the spring's closed form gives from
 * the glide's own clock, so nothing is read back from the page and each mark runs one animation.
 */
import { CHART_SPRINGS } from "./layout/motion";
import { springEasing, springPosition } from "./layout/spring";

/** One of the chart's springs. */
export type ChartSpringName = keyof typeof CHART_SPRINGS;

/** A spring as Web Animations time it, and whether the easing is the spring's own curve. */
type Timing = { readonly duration: number; readonly easing: string; readonly spring: boolean };

/** A running glide: its animation and the offset it started from. */
type Glide = { readonly animation: Animation; readonly from: readonly [number, number] };

const timings = new Map<ChartSpringName, Timing>();

const glides = new WeakMap<Element, Glide>();

/**
 * A spring's duration in milliseconds and its easing: its `linear()` curve, or `ease-out` in an
 * engine without `linear()`, where an unknown easing would throw.
 *
 * @param name - The spring.
 * @returns The timing, sampled once per page.
 */
export function springTiming(name: ChartSpringName): Timing {
  const known = timings.get(name);
  if (known !== undefined) return known;
  const { duration, easing } = springEasing(CHART_SPRINGS[name]);
  const spring = CSS.supports("transition-timing-function", easing);
  const made = { duration, easing: spring ? easing : "ease-out", spring };
  timings.set(name, made);
  return made;
}

/**
 * Glide an element onto the place it rests, from `by` CSS pixels away along x and y, plus whatever
 * offset a running glide shows.
 *
 * @param element - The element whose resting place was just written.
 * @param by - The old resting place less the new one.
 * @param name - The spring.
 */
export function glideFrom(element: Element, by: readonly [number, number], name: ChartSpringName): void {
  const timing = springTiming(name);
  // Without the spring's curve no closed form says where an interrupted glide shows, so the mark
  // moves at once rather than jump when a step interrupts it.
  if (!timing.spring) {
    snapGlide(element);
    return;
  }
  const running = glides.get(element);
  const left =
    running === undefined ? 0 : 1 - springPosition(CHART_SPRINGS[name], elapsed(running.animation) / 1000);
  const x = by[0] + (running?.from[0] ?? 0) * left;
  const y = by[1] + (running?.from[1] ?? 0) * left;
  running?.animation.cancel();
  glides.delete(element);
  if (x === 0 && y === 0) return;
  const animation = element.animate(
    [{ translate: `${String(x)}px ${String(y)}px` }, { translate: "0px 0px" }],
    timing
  );
  glides.set(element, { animation, from: [x, y] });
  animation.onfinish = () => {
    if (glides.get(element)?.animation === animation) glides.delete(element);
  };
}

/**
 * End an element's glide at once, so it shows the place it rests. Every path that places a mark
 * without a step's glide calls it: a mark that shows or hides, a commit or a resize, a change of
 * look, reduced motion and unmounting.
 *
 * @param element - The element that may be gliding.
 */
export function snapGlide(element: Element): void {
  glides.get(element)?.animation.cancel();
  glides.delete(element);
}

/** How far a glide has run, in milliseconds. */
function elapsed(animation: Animation): number {
  // A document timeline's animation keeps its time in milliseconds, and null before it starts.
  const time = Number(animation.currentTime ?? 0);
  return Number.isFinite(time) ? time : 0;
}
