/**
 * A scatter chart's domains as they draw: at rest on the model's, or gliding from where they drew
 * to new ones over a data update, on the chart's update curve and duration. One glide drives every
 * mark and axis of a Root, so the points, the line, the grid and the ticks move as one. It takes
 * its clock and its frame scheduler from its host and touches no browser API itself.
 */
import { cubicBezier } from "./ease";
import { CHART_UPDATE_CURVE, CHART_UPDATE_MS } from "./motion";

/** The x and y domains a frame draws under. */
export type ScatterDomains = {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
};

/** The clock and the frame scheduler a glide runs on. */
export type GlideHost = {
  readonly now: () => number;
  readonly requestFrame: (callback: () => void) => number;
  readonly cancelFrame: (handle: number) => void;
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

const ease = cubicBezier(CHART_UPDATE_CURVE);

function between(from: readonly [number, number], to: readonly [number, number], eased: number) {
  return [from[0] + (to[0] - from[0]) * eased, from[1] + (to[1] - from[1]) * eased] as const;
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
export function createDomainGlide(initial: ScatterDomains, host: GlideHost): DomainGlide {
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
        const progress = Math.min(1, (host.now() - start) / CHART_UPDATE_MS);
        const eased = ease(progress);
        show(
          progress === 1
            ? target
            : { x: between(from.x, target.x, eased), y: between(from.y, target.y, eased) }
        );
        frame = progress === 1 ? null : host.requestFrame(step);
      };
      frame = host.requestFrame(step);
    },
    stop,
  };
}
