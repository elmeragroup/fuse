"use client";

/**
 * A polar Root's one angle follower, which turns the clock's Scrubber, the radar's hand, every
 * ActiveDot and the tooltip's lane offset together. A pointer or key step retargets it, and it
 * keeps its angle and velocity across steps, so a step mid-glide never jumps or stalls, and it never
 * turns faster in a frame than the pointer's speed allows, so a long step moves nothing in a leap. Each frame
 * it calls its subscribers with the angle it shows, and each one writes attributes and styles. It
 * renders nothing and commits nothing.
 */
import type { FollowerCause } from "./chart-followers";
import type { MotionHost } from "./chart-motion";
import { springTiming } from "./chart-spring";
import { followSettled, followStep, shortTarget } from "./layout/angle-follow";
import type { AngleFollow } from "./layout/angle-follow";
import type { Spring } from "./layout/spring";

/** The longest frame the follower advances by, so a frame after a stall never leaps. */
const LONGEST_FRAME_MS = 64;

/** A subscriber, called with the angle the follower shows, in degrees, unwrapped. */
export type FollowListener = (angle: number) => void;

/** A Root's angle follower. */
export type PolarFollow = {
  /**
   * Move the target. A pointer or key step glides there, keeping the speed the follower has. A
   * commit, reduced motion, an engine without `linear()` and the first angle after none snap there.
   * Null means nothing is active, so the next angle snaps.
   */
  readonly retarget: (angle: number | null, cause: FollowerCause) => void;
  /** Call a subscriber on every frame the angle moves. The result unsubscribes it. */
  readonly subscribe: (listener: FollowListener) => () => void;
  /** The angle the follower shows now, or null before any target. */
  readonly shown: () => number | null;
  /** Note the dial's outer radius in CSS pixels, as the cell resizes. */
  readonly measure: (radius: number) => void;
};

/** What the follower reads from its Root on each retarget. */
export type FollowHost = {
  /** The clock and frames it runs on. */
  readonly frames: MotionHost;
  /** Whether the reader prefers reduced motion. */
  readonly reduced: () => boolean;
  /** The spring this step glides on. */
  readonly spring: () => Spring;
  /**
   * The most degrees the follower may turn in one frame of this step on a dial of a radius in CSS
   * pixels, so nothing it moves travels faster than the pointer's speed allows, however far the step
   * reaches.
   */
  readonly maxTurn: (radius: number) => number;
};

/**
 * Create a Root's follower.
 *
 * @param host - The frames, the motion preference and the step's spring.
 * @returns The follower.
 */
export function createPolarFollow(host: FollowHost): PolarFollow {
  const listeners = new Set<FollowListener>();
  let state: AngleFollow | null = null;
  let target: number | null = null;
  let spring: Spring | null = null;
  let maxTurn = Number.POSITIVE_INFINITY;
  let radius = 0;
  let frame: number | null = null;
  let last = 0;
  const call = (angle: number): void => {
    for (const listener of listeners) listener(angle);
  };
  const stop = (): void => {
    if (frame !== null) host.frames.cancelFrame(frame);
    frame = null;
  };
  const tick = (time: number): void => {
    frame = null;
    if (state === null || target === null || spring === null) return;
    const dt = Math.min(time - last, LONGEST_FRAME_MS);
    const next = followStep(state, target, dt, spring);
    const turn = next.angle - state.angle;
    // A step that would turn further in a frame than the pointer's speed allows turns at that pace,
    // and the spring takes over again once it nears the target.
    state =
      Math.abs(turn) > maxTurn && dt > 0
        ? {
            angle: state.angle + Math.sign(turn) * maxTurn,
            velocity: (Math.sign(turn) * maxTurn * 1000) / dt,
          }
        : next;
    last = time;
    if (followSettled(state, target)) {
      state = { angle: target, velocity: 0 };
      call(target);
      return;
    }
    call(state.angle);
    frame = host.frames.requestFrame(tick);
  };
  return {
    retarget(angle, cause) {
      if (angle === null) {
        stop();
        target = null;
        return;
      }
      const shown = state?.angle ?? angle;
      const next = shortTarget(shown, angle);
      const stepSpring = host.spring();
      const glides =
        cause === "step" &&
        state !== null &&
        target !== null &&
        !host.reduced() &&
        springTiming(stepSpring).spring;
      if (!glides) {
        stop();
        state = { angle: next, velocity: 0 };
        target = next;
        call(next);
        return;
      }
      if (next === target && spring === stepSpring) return;
      target = next;
      spring = stepSpring;
      maxTurn = host.maxTurn(radius);
      if (frame === null) {
        last = host.frames.now();
        frame = host.frames.requestFrame(tick);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    shown: () => state?.angle ?? null,
    measure(next) {
      radius = next;
    },
  };
}
