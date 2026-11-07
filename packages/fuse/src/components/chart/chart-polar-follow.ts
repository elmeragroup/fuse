"use client";

/**
 * A polar Root's one angle follower, which turns the clock's Scrubber, the radar's hand, every
 * ActiveDot and the tooltip's lane offset together. A pointer or key step retargets it, and it
 * keeps its angle and velocity across steps, so a step mid-glide never jumps or stalls. A frame turns
 * no faster than the pointer's speed carries a mark, the hand at the rim and each active dot along
 * the curve it rides, which a steep flank stretches, so a ring or spoke step glides with the
 * pointer. It never turns so slowly that a step takes more than 12 frames at that pace, or 10 for a
 * step wider than 90°, so a step
 * across the dial lands within 300 ms at any dial size instead of crawling.
 * Each frame it calls its subscribers with the angle it shows, and each one writes attributes and
 * styles. It renders nothing and commits nothing.
 */
import type { FollowerCause } from "./chart-followers";
import type { MotionHost } from "./chart-motion";
import { springTiming } from "./chart-spring";
import { followSettled, followStep, shortTarget } from "./layout/angle-follow";
import type { AngleFollow } from "./layout/angle-follow";
import type { Spring } from "./layout/spring";

/** The longest frame the follower advances by, so a frame after a stall never leaps. */
const LONGEST_FRAME_MS = 64;

/**
 * The most frames a step's turn takes at its capped pace: 12 for a step of up to 90°, such as a
 * radar's spoke, which at the docs' dial size keeps the pointer's pace, and 10 for a wider one, so
 * a step across the dial lands within 300 ms with the fastest spring's tail.
 */
const LEAP_FRAMES = { near: 12, far: 10 } as const;

/** The widest step, in degrees, that takes the near leap. */
const LEAP_NEAR = 90;

/**
 * The most a mark's stretch slows the pace, so a stepped curve's riser, which a dot climbs in one
 * frame whatever the pace, never holds the hand back.
 */
const STRETCH_MOST = 4;

/**
 * How much more a dot's stretch counts than it reads: the stretch is read at a frame's two ends and
 * its middle, and a curve that bends between them carries the dot a little further.
 */
const STRETCH_MARGIN = 1.07;

/** Half the angle, in degrees, over which a mark's stretch is read. */
export const STRETCH_SPAN = 0.5;

/**
 * How far a mark moves at an angle, in outer radii per radian of turn: 1 for a point on the rim, and
 * more for a dot on a steep flank of its curve, which moves out or in as it turns. Null where it
 * shows nothing.
 */
export type FollowStretch = (angle: number) => number | null;

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
  /**
   * Note how far a mark moves per radian of turn at an angle, so a frame carries it no faster than
   * the pointer's pace. The result forgets it.
   */
  readonly stretch: (stretch: FollowStretch) => () => void;
  /** The angle the follower shows now, or null before any target. */
  readonly shown: () => number | null;
  /**
   * Whether the glide under way leaps: its step reaches so far that the pointer's pace would take
   * more than 12 frames, or 10 past 90°, so it turns the step's span over those frames instead. A popup that rides the
   * follower fades in where the step lands instead of travelling that fast.
   */
  readonly leaps: () => boolean;
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
   * The spring a step that leaps glides on: the fastest follow spring, as a keyboard step's, since
   * the pointer is already where the step lands and only the follower is behind it.
   */
  readonly leapSpring: () => Spring;
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
  const stretches = new Set<FollowStretch>();
  let state: AngleFollow | null = null;
  let target: number | null = null;
  let spring: Spring | null = null;
  let pace = Number.POSITIVE_INFINITY;
  let floor = 0;
  let leaping = false;
  let radius = 0;
  let frame: number | null = null;
  let last = 0;
  const call = (angle: number): void => {
    for (const listener of listeners) listener(angle);
  };
  /**
   * The most any mark stretches between two angles, read at a frame's two ends and its middle, at
   * least the rim's 1 and at most 4.
   */
  const widest = (from: number, to: number): number => {
    let most = 1;
    const reads = 2;
    for (const stretch of stretches) {
      for (let read = 0; read <= reads; read += 1) {
        const value = stretch(from + ((to - from) * read) / reads);
        if (value !== null && value * STRETCH_MARGIN > most) most = value * STRETCH_MARGIN;
      }
    }
    return Math.min(most, STRETCH_MOST);
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
    // A step that would carry a mark further in a frame than the pointer's speed allows turns at
    // that pace, and the spring takes over again once it nears the target.
    const maxTurn = Math.max(pace / (stretches.size === 0 ? 1 : widest(state.angle, next.angle)), floor);
    state =
      Math.abs(turn) > maxTurn && dt > 0
        ? {
            angle: state.angle + Math.sign(turn) * maxTurn,
            velocity: (Math.sign(turn) * maxTurn * 1000) / dt,
          }
        : next;
    last = time;
    if (followSettled(state, target)) {
      leaping = false;
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
      // A step unwraps against the target the follower already chases, not the angle it shows, so a
      // hand trailing a fast whirl by more than half a turn keeps turning the pointer's way instead
      // of taking the short way back. Whole turns of lag drop from the shown angle, so the hand
      // never chases an extra turn: every subscriber draws the angle through its sine, cosine or
      // remainder of 360°, or as a `rotate` with no transition on it, so the shift shows nothing.
      const next = shortTarget(target ?? state?.angle ?? angle, angle);
      if (state !== null) {
        const laps = Math.trunc((next - state.angle) / 360);
        if (laps !== 0) state = { ...state, angle: state.angle + 360 * laps };
      }
      const shown = state?.angle ?? angle;
      const stepSpring = host.spring();
      const glides =
        cause === "step" &&
        state !== null &&
        target !== null &&
        !host.reduced() &&
        springTiming(stepSpring).spring;
      if (!glides) {
        stop();
        leaping = false;
        state = { angle: next, velocity: 0 };
        target = next;
        call(next);
        return;
      }
      // The pointer's pace, floored by the step's own span over 12 frames, or 10 past 90°. A step the floor carries
      // leaps on the fastest spring, so its tail lands as soon as its pace does.
      const stepPace = host.maxTurn(radius);
      const span = Math.abs(next - shown);
      const stepFloor = span / (span > LEAP_NEAR ? LEAP_FRAMES.far : LEAP_FRAMES.near);
      const leaps = stepFloor > stepPace;
      const chosen = leaps ? host.leapSpring() : stepSpring;
      if (next === target && spring === chosen) return;
      target = next;
      spring = chosen;
      pace = stepPace;
      floor = stepFloor;
      leaping = leaps;
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
    stretch(stretch) {
      stretches.add(stretch);
      return () => {
        stretches.delete(stretch);
      };
    },
    shown: () => state?.angle ?? null,
    leaps: () => leaping,
    measure(next) {
      radius = next;
    },
  };
}
