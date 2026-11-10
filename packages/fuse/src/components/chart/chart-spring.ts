"use client";

/**
 * The pointer-following glides on `CHART_SPRINGS`. A follower writes its mark's resting geometry at
 * once, so every attribute and every reader sees the active slot, and `glideFrom` plays a Web
 * Animation of `translate` from where the mark shows back to none. A step mid-glide replaces the
 * running glide with one from the offset it shows now, which the easing the animation plays gives
 * on the glide's own clock, so nothing is read back from the page and each mark runs one animation.
 * The crosshair and the active dots glide on the spring `stepSpring` picks for each step, so they
 * move as one, and an active dot rides its line across the slot axis as it goes.
 */
import type { ChartStore } from "./chart-store";
import { FOLLOW_SPEEDS } from "./layout/motion";
import { rideAt } from "./layout/ride";
import type { RideKeyframe } from "./layout/ride";
import { easingCurve, followSpring, linearEasing, springEasing } from "./layout/spring";
import type { Spring } from "./layout/spring";

/**
 * A spring as Web Animations time it, whether the easing is the spring's own curve, the most it
 * passes its target by as a share of the way, and its curve scaled down by that peak, which never
 * passes 1.
 */
type Timing = {
  readonly duration: number;
  readonly easing: string;
  readonly spring: boolean;
  readonly peak: number;
  readonly held: string;
  /** The output `easing` gives at a progress, as the animation plays it. */
  readonly played: (progress: number) => number;
  /** The output `held` gives at a progress, as a ride's animation plays it. */
  readonly heldPlayed: (progress: number) => number;
};

/** A running glide: its animation, the offset it started from, its spring, and its ride, if any. */
type Glide = {
  readonly animation: Animation;
  readonly from: readonly [number, number];
  readonly spring: Spring;
  /** A ride's slot axis and the keyframes it plays. */
  readonly ride: {
    readonly axis: "x" | "y";
    readonly frames: readonly RideKeyframe[];
  } | null;
};

/**
 * A glide that rides a course: the offset along the slot axis it starts from, where the mark shows
 * less where it rests, the slot axis, and the keyframes from there back to rest and through the
 * spring's overshoot, as offsets along and across at shares of the way, for an easing scaled down
 * by the spring's peak.
 */
export type Ride = {
  readonly along: number;
  readonly axis: "x" | "y";
  readonly keyframes: (peak: number) => readonly RideKeyframe[];
};

const timings = new Map<Spring, Timing>();

const glides = new WeakMap<Element, Glide>();

/**
 * A spring's duration in milliseconds and its easing: its `linear()` curve, or `ease-out` in an
 * engine without `linear()`, where an unknown easing would throw.
 *
 * @param spring - The spring, one of the chart's fixed spring objects.
 * @returns The timing, sampled once per page for each spring.
 */
export function springTiming(spring: Spring): Timing {
  const known = timings.get(spring);
  if (known !== undefined) return known;
  const { duration, easing, stops } = springEasing(spring);
  const supported = CSS.supports("transition-timing-function", easing);
  const peak = Math.max(1, ...stops.map(({ output }) => output));
  // The curve scaled down by its peak, rounded as the held easing writes it.
  const held = stops.map(({ output, input }) => ({ output: Number((output / peak).toFixed(5)), input }));
  const made = {
    duration,
    easing: supported ? easing : "ease-out",
    spring: supported,
    peak,
    held: linearEasing(held),
    played: easingCurve(stops),
    heldPlayed: easingCurve(held),
  };
  timings.set(spring, made);
  return made;
}

/**
 * The spring a step moves the crosshair and the active dots on: `FOLLOW_FASTEST` for a keyboard
 * step, which wants the least motion, so an arrow key held down never trails, and one that quickens
 * with the pointer's speed for a pointer step. Every follower reads the same store in the same step,
 * so all of them take the same spring.
 *
 * @param store - Root's store.
 * @returns The spring.
 */
export function stepSpring(store: ChartStore): Spring {
  return followSpring(
    store.get().source === "keyboard" ? FOLLOW_SPEEDS.fast : (store.pointer()?.speed ?? null)
  );
}

/**
 * The spring of a polar step that leaps across the dial, faster than the pointer's pace would carry
 * it: `FOLLOW_FASTEST`, the keyboard step's, since the pointer is already where the step lands.
 *
 * @returns The spring.
 */
export function leapSpring(): Spring {
  return followSpring(FOLLOW_SPEEDS.fast);
}

/**
 * Glide an element onto the place it rests, from `by` CSS pixels away along x and y, plus whatever
 * offset a running glide shows.
 *
 * @param element - The element whose resting place was just written.
 * @param by - The old resting place less the new one.
 * @param spring - The spring.
 */
export function glideFrom(element: Element, by: readonly [number, number], spring: Spring): void {
  const shown = glideShown(element);
  start(element, [by[0] + (shown?.[0] ?? 0), by[1] + (shown?.[1] ?? 0)], spring, null);
}

/**
 * Glide an element along the slot axis onto the place it rests, from `ride.along` CSS pixels away,
 * with its offset across following the ride's keyframes. Along the slot axis it moves as
 * `glideFrom` would move it on the same spring, so it keeps pace with the crosshair.
 *
 * @param element - The element whose resting place was just written.
 * @param spring - The spring.
 * @param ride - Where the element shows now, a running glide included, along the slot axis from
 *   its rest, the slot axis, and the keyframes it plays.
 */
export function rideFrom(element: Element, spring: Spring, ride: Ride): void {
  start(element, ride.axis === "x" ? [ride.along, 0] : [0, ride.along], spring, ride);
}

/**
 * Glide a length property onto the value it rests at, from `by` CSS pixels away plus whatever
 * offset a running glide of it shows, on the spring and the clock `glideFrom` moves a mark on. The
 * element's own value is its rest, written first, and the glide plays over it.
 *
 * @param element - The element whose resting value was just written.
 * @param property - The registered length property, such as `--chart-active-x`.
 * @param rest - The resting value, in CSS pixels.
 * @param by - The old resting value less the new one.
 * @param spring - The spring.
 */
export function glideLength(
  element: Element,
  property: string,
  rest: number,
  by: number,
  spring: Spring
): void {
  const from = by + (glideShown(element)?.[0] ?? 0);
  snapGlide(element);
  const timing = springTiming(spring);
  if (!timing.spring || from === 0) return;
  const animation = element.animate(
    [{ [property]: `${String(rest + from)}px` }, { [property]: `${String(rest)}px` }],
    timing
  );
  keep(element, { animation, from: [from, 0], spring, ride: null });
}

/**
 * The offset an element's glide shows now, along x and y in CSS pixels, from the easing and the
 * keyframes its animation plays, on the glide's own clock, or null when none runs.
 *
 * @param element - The element that may be gliding.
 * @returns The offset, or null.
 */
export function glideShown(element: Element): readonly [number, number] | null {
  const running = glides.get(element);
  if (running === undefined) return null;
  // The easing the animation plays, its sampled and rounded curve, at the time it shows now.
  const timing = springTiming(running.spring);
  const progress = Math.min(1, elapsed(running.animation) / timing.duration);
  const [x, y] = running.from;
  const { ride } = running;
  if (ride === null) {
    const moved = timing.played(progress);
    return [x * (1 - moved), y * (1 - moved)];
  }
  // The keyframes the animation plays, at the share of their way it shows now.
  const { along, across } = rideAt(ride.frames, timing.heldPlayed(progress));
  return ride.axis === "x" ? [along, across] : [across, along];
}

/** Replace an element's glide with one from an offset, on a spring, riding a course if given. */
function start(element: Element, from: readonly [number, number], spring: Spring, ride: Ride | null): void {
  snapGlide(element);
  const timing = springTiming(spring);
  // Without the spring's curve nothing says where an interrupted glide shows, so the mark
  // moves at once rather than jump when a step interrupts it.
  if (!timing.spring) return;
  const [x, y] = from;
  if (x === 0 && y === 0) return;
  if (ride === null) {
    const animation = element.animate([{ translate: shift(x, y) }, { translate: "0px 0px" }], timing);
    keep(element, { animation, from, spring, ride: null });
    return;
  }
  const frames = ride.keyframes(timing.peak);
  const animation = element.animate(
    frames.map(({ offset, along, across }) => ({
      offset,
      translate: ride.axis === "x" ? rounded(along, across) : rounded(across, along),
    })),
    { duration: timing.duration, easing: timing.held }
  );
  keep(element, { animation, from, spring, ride: { axis: ride.axis, frames } });
}

/** Hold an element's running glide until it finishes or another replaces it. */
function keep(element: Element, glide: Glide): void {
  glides.set(element, glide);
  glide.animation.onfinish = () => {
    if (glides.get(element)?.animation === glide.animation) glides.delete(element);
  };
}

function shift(x: number, y: number): string {
  return `${String(x)}px ${String(y)}px`;
}

/** A shift to a hundredth of a pixel, which keeps a long keyframe list short to parse. */
function rounded(x: number, y: number): string {
  return `${x.toFixed(2)}px ${y.toFixed(2)}px`;
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
