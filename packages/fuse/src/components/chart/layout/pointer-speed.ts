/**
 * A pointer's speed over its recent moves, which picks the spring a follower glides on. Chart's
 * store and SparklineHover track the pointer through the same math.
 */

/**
 * The pointer's last position, in client pixels, its pointer type, when it got there
 * in milliseconds on the event clock, and how fast it has moved lately, in client pixels per
 * millisecond.
 */
export type TrackedPointer = {
  readonly x: number;
  readonly y: number;
  readonly type: string;
  readonly time: number;
  readonly speed: number;
};

/**
 * How much of a pointer's speed each move takes from its own distance and time, the rest from the
 * speed before it, so one quick event among slow ones counts for less than a flick.
 */
const SPEED_WEIGHT = 0.5;

/**
 * A pointer's next tracked position at an event's time stamp, with the speed of its recent moves.
 * A move of another pointer type, or at no later time, starts the speed over at 0.
 *
 * @param last - The pointer as last tracked, or null before its first move.
 * @param x - The client x, in CSS pixels.
 * @param y - The client y, in CSS pixels.
 * @param type - The event's pointer type.
 * @param time - The event's time stamp, in milliseconds.
 * @returns The tracked pointer.
 */
export function trackPointer(
  last: TrackedPointer | null,
  x: number,
  y: number,
  type: string,
  time: number
): TrackedPointer {
  const gap = last === null || last.type !== type ? 0 : time - last.time;
  const speed =
    last === null || gap <= 0
      ? 0
      : SPEED_WEIGHT * (Math.hypot(x - last.x, y - last.y) / gap) + (1 - SPEED_WEIGHT) * last.speed;
  return { x, y, type, time, speed };
}
