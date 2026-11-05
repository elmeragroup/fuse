/**
 * A damped spring of mass 1 sampled as a CSS `linear()` easing, so a CSS transition or a Web
 * Animation plays it and a retarget starts from whatever the element shows. The curve runs from 0 to
 * 1 over the time the spring takes to stay within 0.1% of its target, and keeps the stops a
 * piecewise-linear curve needs to stay within 0.1% of the spring.
 */

import { CHART_SPRINGS, FOLLOW_FASTEST, FOLLOW_LEVELS, FOLLOW_SPEEDS } from "./motion";

/** A spring of mass 1, named by its stiffness and its damping. */
export type Spring = { readonly stiffness: number; readonly damping: number };

/**
 * One stop of a `linear()` easing, rounded as the easing writes it: its output, and its input in
 * percent of the way.
 */
export type EasingStop = { readonly output: number; readonly input: number };

/**
 * A spring as CSS plays it: a duration in milliseconds, a `linear()` easing, and the easing's stops
 * as numbers, which `linearEasing` writes and `easingCurve` plays.
 */
export type SpringEasing = {
  readonly duration: number;
  readonly easing: string;
  readonly stops: readonly EasingStop[];
};

/** How far from its target the spring may still be once its duration ends. */
const SETTLED = 0.001;

/** How far the easing's chords may stray from the spring. */
const TOLERANCE = 0.001;

/** How many even samples the stops are chosen from. */
const SAMPLES = 400;

/** The longest duration searched, in milliseconds. */
const LONGEST = 5000;

/**
 * The spring's position at `t` seconds, released from rest at 0 towards 1.
 *
 * @param spring - The spring's stiffness and damping, mass 1.
 * @param t - Seconds since release.
 * @returns The share of the way the spring has come.
 */
export function springPosition({ stiffness, damping }: Spring, t: number): number {
  const natural = Math.sqrt(stiffness);
  const ratio = damping / (2 * natural);
  if (ratio < 1) {
    const damped = natural * Math.sqrt(1 - ratio * ratio);
    const decay = Math.exp(-ratio * natural * t);
    return 1 - decay * (Math.cos(damped * t) + ((ratio * natural) / damped) * Math.sin(damped * t));
  }
  if (ratio === 1) return 1 - Math.exp(-natural * t) * (1 + natural * t);
  const root = natural * Math.sqrt(ratio * ratio - 1);
  const fast = -ratio * natural - root;
  const slow = -ratio * natural + root;
  return 1 - (fast * Math.exp(slow * t) - slow * Math.exp(fast * t)) / (fast - slow);
}

const round = (value: number, digits: number): number => Number(value.toFixed(digits));

/**
 * A spring as a CSS duration and `linear()` easing.
 *
 * @param spring - The spring's stiffness and damping, mass 1.
 * @returns The milliseconds until it stays within 0.1% of its target, and the easing over them.
 */
export function springEasing(spring: Spring): SpringEasing {
  // The last whole millisecond the spring is still 0.1% or more from its target ends the curve.
  let duration = 1;
  for (let ms = 1; ms <= LONGEST; ms += 1) {
    if (Math.abs(1 - springPosition(spring, ms / 1000)) >= SETTLED) duration = ms + 1;
  }
  const values = Array.from({ length: SAMPLES + 1 }, (_, index) =>
    index === SAMPLES ? 1 : springPosition(spring, (index / SAMPLES) * (duration / 1000))
  );
  // Each stop reaches as far as a chord from the last stop stays within the tolerance of every
  // sample it spans.
  const kept = [0];
  let from = 0;
  while (from < SAMPLES) {
    let to = from + 1;
    while (to < SAMPLES && fits(values, from, to + 1)) to += 1;
    kept.push(to);
    from = to;
  }
  const stops = kept.map((index, order): EasingStop => {
    if (order === 0) return { output: 0, input: 0 };
    if (index === SAMPLES) return { output: 1, input: 100 };
    return { output: round(values[index] ?? 1, 4), input: round((index / SAMPLES) * 100, 2) };
  });
  return { duration, easing: linearEasing(stops), stops };
}

/**
 * A `linear()` easing through stops, the first and the last written without their inputs, which
 * CSS places at 0% and 100%.
 *
 * @param stops - The stops, inputs never falling, from 0 to 100.
 * @returns The easing.
 */
export function linearEasing(stops: readonly EasingStop[]): string {
  const written = stops.map(({ output, input }, index) =>
    index === 0 || index === stops.length - 1 ? String(output) : `${String(output)} ${String(input)}%`
  );
  return `linear(${written.join(", ")})`;
}

/** Whether the chord from sample `from` to sample `to` stays within the tolerance of each between. */
function fits(values: readonly number[], from: number, to: number): boolean {
  const start = values[from] ?? 0;
  const end = values[to] ?? 1;
  for (let index = from + 1; index < to; index += 1) {
    const chord = start + ((index - from) / (to - from)) * (end - start);
    if (Math.abs(chord - (values[index] ?? 0)) > TOLERANCE) return false;
  }
  return true;
}

/**
 * The spring the crosshair and the active dots follow a step on. A keyboard step, which has no
 * speed, and a pointer at `FOLLOW_SPEEDS.slow` or slower take `CHART_SPRINGS.follow`; a pointer at
 * `FOLLOW_SPEEDS.fast` or faster takes `FOLLOW_FASTEST`. Between them the natural frequency grows
 * with the speed and lands on the nearest of `FOLLOW_LEVELS` even steps. The damping keeps
 * `follow`'s damping ratio, so every level overshoots alike.
 *
 * @param speed - The pointer's speed in CSS pixels per millisecond, or null for a keyboard step.
 * @returns The spring, one of `FOLLOW_LEVELS` fixed objects.
 */
export function followSpring(speed: number | null): Spring {
  const { slow, fast } = FOLLOW_SPEEDS;
  const share = speed === null ? 0 : Math.min(1, Math.max(0, (speed - slow) / (fast - slow)));
  return FOLLOW_LADDER[Math.round(share * (FOLLOW_LEVELS - 1))] ?? CHART_SPRINGS.follow;
}

/** The follow springs from `follow` to `FOLLOW_FASTEST`, evenly spaced in natural frequency. */
const FOLLOW_LADDER: readonly Spring[] = Array.from({ length: FOLLOW_LEVELS }, (_, level) => {
  const { stiffness, damping } = CHART_SPRINGS.follow;
  const ratio = damping / (2 * Math.sqrt(stiffness));
  const natural =
    Math.sqrt(stiffness) + ((Math.sqrt(FOLLOW_FASTEST) - Math.sqrt(stiffness)) * level) / (FOLLOW_LEVELS - 1);
  return level === 0 ? CHART_SPRINGS.follow : { stiffness: natural * natural, damping: 2 * ratio * natural };
});

/**
 * A `linear()` easing's stops as a function of progress, as CSS Easing 2 plays them: a straight
 * line between each pair of stops, and the first and last stops held past either end. A glide that
 * reads where an interrupted animation shows reads the curve the animation plays, its rounding
 * included, not the spring it samples.
 *
 * @param stops - The stops, inputs never falling, from 0 to 100.
 * @returns The output at a progress from 0 to 1.
 */
export function easingCurve(stops: readonly EasingStop[]): (progress: number) => number {
  const points = stops.map(({ output, input }) => ({ output, input: input / 100 }));
  return (progress) => {
    const first = points[0];
    const last = points.at(-1);
    if (first === undefined || last === undefined) return progress;
    if (progress <= first.input) return first.output;
    if (progress >= last.input) return last.output;
    let after = 1;
    while ((points[after]?.input ?? 1) < progress) after += 1;
    const end = points[after] ?? last;
    const start = points[after - 1] ?? first;
    const span = end.input - start.input;
    return span === 0
      ? end.output
      : start.output + ((end.output - start.output) * (progress - start.input)) / span;
  };
}
