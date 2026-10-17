import type { ReactElement } from "react";

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { CLAMP } from "../../motion/easing";

// From the remocn registry (`@remocn/simulated-cursor`), restyled for Fuse: the arrow fills with
// the foreground over a background outline, the click ripple draws in the primary role, and the
// path is timed by frames the caller names instead of fixed legs.

/** One stop on the cursor's path, in stage pixels, reached on frame `at`. */
export type CursorStop = {
  readonly x: number;
  readonly y: number;
  readonly at: number;
  /** Whether the cursor clicks on arrival. */
  readonly click?: boolean;
};

/** Frames the cursor takes to travel to a stop. */
const TRAVEL_FRAMES = 14;

/** The cursor's position on a frame, easing into each stop over the frames before it. */
function positionAt(stops: readonly CursorStop[], frame: number): { x: number; y: number } {
  let position = { x: stops[0]?.x ?? 0, y: stops[0]?.y ?? 0 };
  for (const stop of stops) {
    const progress = interpolate(frame, [stop.at - TRAVEL_FRAMES, stop.at], [0, 1], {
      ...CLAMP,
      easing: (t) => 1 - (1 - t) ** 3,
    });
    position = {
      x: position.x + (stop.x - position.x) * progress,
      y: position.y + (stop.y - position.y) * progress,
    };
  }
  return position;
}

/** Props for {@link SimulatedCursor}. */
export type SimulatedCursorProps = {
  readonly stops: readonly CursorStop[];
  /** The cursor's height, in stage pixels. */
  readonly size?: number;
};

/**
 * A pointer that travels between stops and clicks on the ones that ask for it, with a dip and a
 * ripple. It fills its positioned parent and ignores pointer events.
 *
 * @returns The cursor layer.
 */
export function SimulatedCursor({ stops, size = 28 }: SimulatedCursorProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { x, y } = positionAt(stops, frame);
  const lastClick = stops.filter((stop) => stop.click === true && stop.at <= frame).at(-1);
  const sinceClick = lastClick === undefined ? Number.POSITIVE_INFINITY : frame - lastClick.at;
  const dip = Number.isFinite(sinceClick)
    ? spring({
        fps,
        frame: sinceClick,
        config: { damping: 10, stiffness: 200, mass: 0.6 },
        durationInFrames: 14,
      })
    : 0;
  const pressed = Number.isFinite(sinceClick) ? 1 - Math.sin(Math.min(dip, 1) * Math.PI) * 0.18 : 1;
  const ripple = Number.isFinite(sinceClick) ? interpolate(sinceClick, [0, 24], [0, 1], CLAMP) : 1;

  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {ripple < 1 && lastClick !== undefined ? (
        <span
          style={{
            position: "absolute",
            left: lastClick.x,
            top: lastClick.y,
            width: 120,
            height: 120,
            translate: "-50% -50%",
            borderRadius: "50%",
            border: "2px solid var(--primary)",
            scale: String(0.05 + ripple * 0.95),
            opacity: 0.6 * (1 - ripple),
          }}
        />
      ) : null}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: x,
          top: y,
          scale: String(pressed),
          transformOrigin: "top left",
        }}>
        <path
          d="M5 3L5 19L9.5 14.5L12.5 21L15 20L12 13.5L18.5 13.5L5 3Z"
          fill="var(--foreground)"
          stroke="var(--background)"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
