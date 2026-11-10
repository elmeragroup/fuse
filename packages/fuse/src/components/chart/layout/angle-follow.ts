import { turnOf } from "./polar-angle";
/**
 * An angle that follows its target on a damped spring of mass 1 and keeps its velocity when the
 * target moves, so a step mid-glide never jumps and never stalls. A polar Root turns its hand, its
 * active dots and its tooltip's lane offset on one of these. The spring advances in closed form,
 * since the stiffest follow spring at 60 Hz has ω·dt ≈ 1.2, which would destabilise a numeric step.
 */
import type { Spring } from "./spring";

/** A follower's state: the shown angle in degrees, unwrapped, and its velocity in degrees per second. */
export type AngleFollow = { readonly angle: number; readonly velocity: number };

/** How near its target, in degrees, a settled follower rests. */
const SETTLED_ANGLE = 0.01;

/** How slow, in degrees per second, a settled follower moves. */
const SETTLED_SPEED = 0.1;

/**
 * The target unwrapped to within 180° of the shown angle, so a step takes the short way round, and
 * a half turn goes clockwise.
 *
 * @param shown - The angle the follower shows, unwrapped.
 * @param target - The target in any turn.
 * @returns The target in the turn nearest the shown angle.
 */
export function shortTarget(shown: number, target: number): number {
  const ahead = turnOf(target - shown);
  return shown + (ahead > 180 ? ahead - 360 : ahead);
}

/**
 * Advance a damped spring of mass 1 toward its target by `dtMs` from any position and velocity, in
 * closed form. A retarget changes only the target, so the position and velocity carry over, and no
 * time passed leaves the state as it was.
 *
 * @param state - The angle and velocity now.
 * @param target - The angle the spring pulls toward, in the shown angle's turn.
 * @param dtMs - Milliseconds to advance.
 * @param spring - The spring's stiffness and damping.
 * @returns The angle and velocity after `dtMs`.
 */
export function followStep(state: AngleFollow, target: number, dtMs: number, spring: Spring): AngleFollow {
  if (dtMs <= 0) return state;
  const t = dtMs / 1000;
  const x0 = state.angle - target;
  const v0 = state.velocity;
  const omega = Math.sqrt(spring.stiffness);
  const zeta = spring.damping / (2 * omega);
  if (Math.abs(zeta - 1) < 1e-9) {
    const b = v0 + omega * x0;
    const decay = Math.exp(-omega * t);
    return { angle: target + (x0 + b * t) * decay, velocity: decay * (b - omega * (x0 + b * t)) };
  }
  if (zeta < 1) {
    const damped = omega * Math.sqrt(1 - zeta * zeta);
    const a = zeta * omega;
    const b = (v0 + a * x0) / damped;
    const decay = Math.exp(-a * t);
    const cos = Math.cos(damped * t);
    const sin = Math.sin(damped * t);
    return {
      angle: target + decay * (x0 * cos + b * sin),
      velocity: decay * ((b * damped - a * x0) * cos - (a * b + x0 * damped) * sin),
    };
  }
  const root = omega * Math.sqrt(zeta * zeta - 1);
  const slow = -zeta * omega + root;
  const fast = -zeta * omega - root;
  const c2 = (v0 - slow * x0) / (fast - slow);
  const c1 = x0 - c2;
  return {
    angle: target + c1 * Math.exp(slow * t) + c2 * Math.exp(fast * t),
    velocity: slow * c1 * Math.exp(slow * t) + fast * c2 * Math.exp(fast * t),
  };
}

/**
 * Whether a follower has settled: within 0.01° of its target and slower than 0.1° per second.
 *
 * @param state - The angle and velocity now.
 * @param target - The target in the shown angle's turn.
 * @returns True once it rests.
 */
export function followSettled(state: AngleFollow, target: number): boolean {
  return Math.abs(state.angle - target) < SETTLED_ANGLE && Math.abs(state.velocity) < SETTLED_SPEED;
}
