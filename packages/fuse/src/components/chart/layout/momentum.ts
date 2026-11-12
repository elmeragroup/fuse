/**
 * The momentum spring a moving mark leaves on when its target changes, so the loop's `move` with
 * `momentum: "keep"` bends the mark's course instead of turning it at once. Each number moves on a
 * critically damped spring, `x(t) = to + (c₁ + c₂·t)·e^(−ωt)` with `c₁ = from − to` and
 * `c₂ = v₀ + ω·c₁`, which starts at `from` moving at `v₀` and never bounces. Its frequency is chosen
 * per number so it never shows a value its course does not reach: it never passes its target, and it
 * never leaves its span, the values the mark already moved between. `chart-motion.ts` schedules it.
 */
import { CHART_UPDATE_MS } from "./motion";
import { criticalStep } from "./spring";

/** The lowest and the highest value a number moved between. */
export type Span = readonly [low: number, high: number];

/**
 * One number's momentum spring, beside the tween's start and target it leaves from and rests on:
 * its velocity at the start, in its units per millisecond, its critically damped angular frequency,
 * per millisecond, and its span, the range every tween it took over moved within, which it never
 * leaves.
 */
export type NumberSpring = {
  readonly velocity: number;
  readonly omega: number;
  readonly span: Span;
};

/** A momentum tween's spring: one per number the mark moves, in the order of its start and target. */
export type MomentumSpring = readonly NumberSpring[];

/** Where a tween's numbers are at one time, and how fast each moves, in its units per millisecond. */
export type MomentumPoint = { readonly values: number[]; readonly velocity: number[] };

/** A momentum move's spring and how long it takes to settle, in milliseconds. */
export type MomentumMove = { readonly spring: MomentumSpring; readonly duration: number };

/** What a number's spring is chosen as: its angular frequency and the velocity it leaves with. */
type Course = { readonly omega: number; readonly velocity: number };

/**
 * A momentum spring's angular frequency times its duration, which leaves `(1 + x)·e^(−x)`, the share
 * of its start offset a critically damped spring released from rest still holds, at 0.1 % when the
 * duration ends, where the last frame writes the target.
 */
const MOMENTUM_SETTLE = 9.2334;

/** A frame at 60 frames a second, in milliseconds, which a turning spring keeps its way through. */
const FRAME_MS = 1000 / 60;

/** The longest a momentum move may take to settle, in milliseconds: twice the update's. */
const MOMENTUM_LONGEST = 2 * CHART_UPDATE_MS;

/** The angular frequency that settles within the update's duration, per millisecond. */
const BASE_OMEGA = MOMENTUM_SETTLE / CHART_UPDATE_MS;

/**
 * How far a spring's excursion goes past where it starts, for a number `distance` past its target
 * and moving on away from it at `speed`, both 0 or more, at angular frequency `omega`: the peak of
 * `(d + (s + ω·d)·t)·e^(−ωt)`, at `t = s / (ω·(s + ω·d))`, less `d`.
 */
function excursion(distance: number, speed: number, omega: number): number {
  const peakAt = speed / (omega * (speed + omega * distance));
  return (distance + speed / omega) * Math.exp(-omega * peakAt) - distance;
}

/**
 * One number's momentum spring, which never shows a value its course does not reach. Moving toward
 * its target, it stiffens until its velocity is no more than `ω` times the way left, so it settles
 * onto the target without passing it, however short the way. Moving away, it softens until its
 * deceleration takes at least a frame to turn it, so it never stops dead in one frame, and no softer
 * than settles in twice the update's duration; then it stiffens until it turns back before it
 * leaves its span, the values the mark already moved between, which wins over the frame, and a
 * number at the edge of its span stops there.
 */
function numberSpring(from: number, to: number, speed: number, span: Span): Course {
  const ahead = to - from;
  if (speed === 0) return { omega: BASE_OMEGA, velocity: 0 };
  if (Math.sign(speed) === Math.sign(ahead)) {
    return { omega: Math.max(BASE_OMEGA, Math.abs(speed) / Math.abs(ahead)), velocity: speed };
  }
  const room = speed > 0 ? span[1] - from : from - span[0];
  const distance = Math.abs(ahead);
  const away = Math.abs(speed);
  // At the edge of its span a number has no room to turn in, so it stops there and settles back.
  if (!(room > 1e-9)) return { omega: BASE_OMEGA, velocity: 0 };
  // Moving away by d at v₀, the spring's velocity reaches 0 at t = v₀ / (ω·(v₀ + ω·d)), a frame T
  // or later while T·d·ω² + T·v₀·ω − v₀ ≤ 0, whose larger root is the stiffest such spring.
  const turning =
    distance > 0
      ? (-FRAME_MS * away + Math.sqrt((FRAME_MS * away) ** 2 + 4 * FRAME_MS * distance * away)) /
        (2 * FRAME_MS * distance)
      : 1 / FRAME_MS;
  const soft = Math.max(MOMENTUM_SETTLE / MOMENTUM_LONGEST, Math.min(BASE_OMEGA, turning));
  if (excursion(distance, away, soft) <= room) return { omega: soft, velocity: speed };
  let low = soft;
  let high = soft * 2;
  while (excursion(distance, away, high) > room) high *= 2;
  for (let round = 0; round < 60; round += 1) {
    const middle = (low + high) / 2;
    if (excursion(distance, away, middle) > room) low = middle;
    else high = middle;
  }
  return { omega: high, velocity: speed };
}

/**
 * The span a number moves within: the span the tween it takes over moved within, widened to that
 * tween's start, its target and where the number shows.
 *
 * @param from - The replaced tween's start.
 * @param to - The replaced tween's target.
 * @param drawn - Where the number shows.
 * @param known - The replaced tween's own span, for a momentum tween.
 * @returns The span.
 */
export function spanAround(from: number, to: number, drawn: number, known: Span | undefined): Span {
  return [Math.min(from, to, drawn, known?.[0] ?? drawn), Math.max(from, to, drawn, known?.[1] ?? drawn)];
}

/**
 * The spring a moving mark leaves on toward its targets, and how long it takes to settle: the
 * update's duration, or longer for a softened turn, never longer than twice it.
 *
 * @param move - Where each number shows, its target, its velocity and its span.
 * @returns The spring and its duration.
 */
export function momentumSpring(move: {
  readonly from: readonly number[];
  readonly to: readonly number[];
  readonly velocity: readonly number[];
  readonly spans: readonly Span[];
}): MomentumMove {
  const spring = move.to.map((to, index): NumberSpring => {
    const from = move.from[index] ?? to;
    const span = move.spans[index] ?? [to, to];
    return { span, ...numberSpring(from, to, move.velocity[index] ?? 0, span) };
  });
  const softest = Math.min(...spring.map((number) => number.omega));
  return {
    duration: Math.min(MOMENTUM_LONGEST, Math.max(CHART_UPDATE_MS, MOMENTUM_SETTLE / softest)),
    spring,
  };
}

/**
 * Where a spring's numbers are a time into it, and how fast each moves.
 *
 * @param spring - The spring.
 * @param from - The numbers it leaves from, its tween's start.
 * @param to - The numbers it rests on, its tween's target.
 * @param t - Milliseconds into it.
 * @returns The numbers and their velocities, in their units per millisecond.
 */
export function springAt(
  spring: MomentumSpring,
  from: readonly number[],
  to: readonly number[],
  t: number
): MomentumPoint {
  const values: number[] = [];
  const velocity: number[] = [];
  spring.forEach((number, index) => {
    const target = to[index] ?? 0;
    const step = criticalStep((from[index] ?? target) - target, number.velocity, number.omega, t);
    values.push(target + step.offset);
    velocity.push(step.velocity);
  });
  return { values, velocity };
}

/**
 * A spring's share of the way from rest at a progress through its duration, as a curve's eased
 * progress reads, which a resize's retarget reads.
 *
 * @param progress - The share of its duration, 0 to 1.
 * @returns The share of the way.
 */
export function springProgress(progress: number): number {
  return 1 + criticalStep(-1, 0, MOMENTUM_SETTLE, progress).offset;
}
