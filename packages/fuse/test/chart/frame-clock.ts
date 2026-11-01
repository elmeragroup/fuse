/**
 * A hand-driven frame clock for chart browser tests. Root's loop reads `performance.now()` and
 * schedules `requestAnimationFrame` through the globals at call time, so replacing both before the
 * chart mounts puts every tween on this clock: a commit starts at the clock's time, and `frameAt`
 * runs the queued frames at a chosen instant. Web Animations keep the document's own timeline.
 */

/** A clock that owns the page's frames until it is restored. */
export type FrameClock = {
  /** The clock's time in milliseconds. */
  readonly now: () => number;
  /** Move the clock to an instant and run every frame queued before it, once. */
  readonly frameAt: (time: number) => void;
  /** Hand the frames back to the browser. */
  readonly restore: () => void;
};

/**
 * Take over `performance.now` and `requestAnimationFrame`.
 *
 * @param start - The clock's first time.
 * @returns The clock.
 */
export function installFrameClock(start = 1000): FrameClock {
  let time = start;
  let handle = 0;
  const queued = new Map<number, FrameRequestCallback>();
  const originals = {
    now: performance.now.bind(performance),
    request: window.requestAnimationFrame.bind(window),
    cancel: window.cancelAnimationFrame.bind(window),
  };
  performance.now = () => time;
  window.requestAnimationFrame = (callback) => {
    handle += 1;
    queued.set(handle, callback);
    return handle;
  };
  window.cancelAnimationFrame = (id) => {
    queued.delete(id);
  };
  return {
    now: () => time,
    frameAt: (at) => {
      time = at;
      const due = [...queued.values()];
      queued.clear();
      for (const callback of due) callback(at);
    },
    restore: () => {
      performance.now = originals.now;
      window.requestAnimationFrame = originals.request;
      window.cancelAnimationFrame = originals.cancel;
    },
  };
}
