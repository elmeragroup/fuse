/**
 * A damped spring of mass 1 sampled as a CSS `linear()` easing, so a CSS transition or a Web
 * Animation plays it and a retarget starts from whatever the element shows. The curve runs from 0 to
 * 1 over the time the spring takes to stay within 0.1% of its target, and keeps the stops a
 * piecewise-linear curve needs to stay within 0.1% of the spring.
 */

/** A spring of mass 1, as bklit and Motion name them. */
export type Spring = { readonly stiffness: number; readonly damping: number };

/** A spring as CSS plays it: a duration in milliseconds and a `linear()` easing. */
export type SpringEasing = { readonly duration: number; readonly easing: string };

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

const round = (value: number, digits: number): string => String(Number(value.toFixed(digits)));

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
  const stops = kept.map((index, order) => {
    if (order === 0) return "0";
    if (index === SAMPLES) return "1";
    return `${round(values[index] ?? 1, 4)} ${round((index / SAMPLES) * 100, 2)}%`;
  });
  return { duration, easing: `linear(${stops.join(", ")})` };
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
