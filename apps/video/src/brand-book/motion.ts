import { interpolate } from "remotion";

import { CLAMP, PUSH } from "../motion/easing";

/**
 * How far a push has run on a frame, from 0 before `from` to 1 at `to`.
 *
 * @param frame - The frame.
 * @param from - The frame the push starts on.
 * @param to - The frame it lands on.
 * @returns The eased progress, held at its ends.
 */
export function push(frame: number, from: number, to: number): number {
  return interpolate(frame, [from, to], [0, 1], { ...CLAMP, easing: PUSH });
}
