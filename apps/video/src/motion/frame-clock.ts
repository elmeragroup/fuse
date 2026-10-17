import { useCurrentFrame, useVideoConfig } from "remotion";

/** A frame on a part's timeline and the frame rate it counts in. */
export type FrameClock = {
  readonly frame: number;
  readonly fps: number;
};

/**
 * The caller's frame on its own timeline, as Remotion reports it inside the nearest Sequence.
 *
 * @returns The frame and the frame rate.
 */
export function useFrameClock(): FrameClock {
  return { frame: useCurrentFrame(), fps: useVideoConfig().fps };
}

/**
 * The render's readiness: a held render is not captured until every hold is released. Remotion's
 * `useDelayRender()` returns one; a test passes its own to watch when the frame becomes ready.
 */
export type RenderHold = {
  readonly delayRender: (label: string) => number;
  readonly continueRender: (handle: number) => void;
  readonly cancelRender: (error: Error) => void;
};
