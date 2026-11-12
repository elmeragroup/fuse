/**
 * A scatter chart's domains as they draw: at rest on the model's, or gliding from where they drew
 * to new ones over a data update, on the chart's update curve and duration. One glide drives every
 * mark and axis of a Root, so the points, the line, the grid and the ticks move as one. It takes
 * its clock and its frame scheduler from its host and touches no browser API itself.
 */
import type { MotionHost } from "../chart-motion";
import { CHART_UPDATE_MS, updateTween } from "./motion";

/** The x and y domains a frame draws under. */
export type ScatterDomains = {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
};

/** The domains a Root draws under, which its parts subscribe to. */
export type DomainGlide = {
  /** The domains as they draw now. The same object until they move. */
  readonly get: () => ScatterDomains;
  readonly subscribe: (listener: () => void) => () => void;
  /**
   * Move to new domains: at once under "snap", or from where they draw now over the update's
   * duration under "glide", which a second call mid-glide retargets from where it has got to.
   */
  readonly to: (target: ScatterDomains, how: "snap" | "glide") => void;
  /** Stop a running glide where it is. */
  readonly stop: () => void;
};

/** A domain pair on its update glide at a time. */
function between(
  from: readonly [number, number],
  to: readonly [number, number],
  start: number,
  now: number
): readonly [number, number] {
  return [updateTween(from[0], to[0], start, now), updateTween(from[1], to[1], start, now)];
}

function same(a: ScatterDomains, b: ScatterDomains): boolean {
  return a.x[0] === b.x[0] && a.x[1] === b.x[1] && a.y[0] === b.y[0] && a.y[1] === b.y[1];
}

/**
 * Create a Root's domain glide.
 *
 * @param initial - The domains the chart first draws under.
 * @param host - The clock and the frame scheduler.
 * @returns The glide.
 */
export function createDomainGlide(initial: ScatterDomains, host: MotionHost): DomainGlide {
  let current = initial;
  let frame: number | null = null;
  const listeners = new Set<() => void>();
  const show = (next: ScatterDomains): void => {
    if (same(next, current)) return;
    current = next;
    for (const listener of listeners) listener();
  };
  const stop = (): void => {
    if (frame !== null) host.cancelFrame(frame);
    frame = null;
  };
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    to(target, how) {
      stop();
      if (how === "snap" || same(target, current)) {
        show(target);
        return;
      }
      const from = current;
      const start = host.now();
      const step = (): void => {
        const now = host.now();
        const done = now - start >= CHART_UPDATE_MS;
        show(
          done
            ? target
            : { x: between(from.x, target.x, start, now), y: between(from.y, target.y, start, now) }
        );
        frame = done ? null : host.requestFrame(step);
      };
      frame = host.requestFrame(step);
    },
    stop,
  };
}
