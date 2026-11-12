/**
 * A live line chart's clock: the one frame loop that scrolls its window and eases its value domain
 * and its live tip. Each frame the window ends at the wall clock, so the line moves at the pace of
 * time itself, never in jumps of one reading. A new reading or a domain that no longer fits starts
 * a glide from what the frame shows to the new target, on the chart's update curve and duration, so
 * the domain and the tip never snap. Readings are known by their time: a new latest reading glides
 * from where the line ended, the tip's shown value, to its own value, and a corrected reading still
 * on its way, or the one the line ended on, from where it showed, each on its own glide that a
 * newer reading never restarts, so every glide ends within the update duration of its start. Root's
 * `value`, the tip, glides apart from the readings on the same curve. The domain a frame shows is
 * the domain's glide widened at once to every value the frame draws, so no mark leaves the plot
 * whatever the feed does: a domain eases inward, and outward only as far as no drawn value already
 * took it. Parts subscribe and write the frame to the DOM themselves, so React commits nothing while
 * the line scrolls.
 *
 * The loop runs only while the chart is live, shown and subscribed, and requestAnimationFrame stops
 * in a hidden tab, so a chart in a background tab or scrolled out of view costs no frames. On its
 * return the window jumps to the wall clock and catches up with the readings it missed. Under
 * reduced motion the clock is still: no loop runs, each feed redraws once at the wall clock, and
 * the domain and the tip snap. A paused clock holds its frame until it resumes. The clock takes its
 * wall clock and frames from its host and reads no browser API itself.
 */
import type { MotionHost } from "../chart-motion";
import {
  indexAt,
  liveDomain,
  liveExtent,
  liveVertices,
  valueRange,
  visibleSpan,
  windowEndingAt,
} from "./live-window";
import type { LivePoint, LiveSpan, LiveWindow } from "./live-window";
import { CHART_UPDATE_MS, updateTween } from "./motion";

/** A host's frames, its frame clock, and the wall clock in epoch milliseconds. */
export type LiveClockHost = MotionHost & { readonly epoch: () => number };

/** What a frame draws. */
export type LiveFrame = {
  /**
   * The feed the frame draws, the same object until the clock takes another, which every readout
   * that names a reading reads, so a paused chart names what it shows. `span` indexes its readings.
   */
  readonly feed: LiveFeed;
  /** The clock, the window's end, in epoch milliseconds. */
  readonly now: number;
  readonly window: LiveWindow;
  /** The readings inside the window. */
  readonly span: LiveSpan;
  /** The value domain as it shows now. */
  readonly domain: readonly [number, number];
  /** The tip's value as it shows now, or null with no reading. */
  readonly tip: number | null;
  /** The value each gliding reading shows now, by its time: the live one and any still settling. */
  readonly held: ReadonlyMap<number, number>;
  /** The points the line runs through, in time order, by `liveVertices`. */
  readonly vertices: readonly LivePoint[];
};

/** What the chart feeds its clock. */
export type LiveFeed = {
  /** The readings in time order. */
  readonly points: readonly LivePoint[];
  /** The latest value, null exactly when there is no reading. */
  readonly tip: number | null;
  /** The window's length in milliseconds. */
  readonly duration: number;
};

/**
 * How the clock runs: "live" scrolls frame by frame, "still" redraws once per feed at the wall
 * clock with no motion, for reduced motion, and "paused" holds its frame until it runs again.
 */
export type LiveMode = "live" | "still" | "paused";

/** A chart's clock. */
export type LiveClock = {
  /** The frame as it shows now. The same object until it changes. */
  readonly get: () => LiveFrame;
  /** Subscribe to every new frame. The loop runs only while something subscribes. */
  readonly subscribe: (listener: () => void) => () => void;
  /** Take new readings, a new tip or a new duration. */
  readonly feed: (feed: LiveFeed) => void;
  /** Change how the clock runs. */
  readonly setMode: (mode: LiveMode) => void;
  /** Whether the chart is in view, which the loop needs to run. */
  readonly setVisible: (visible: boolean) => void;
};

/** A value's update glide, started at a frame-clock time. */
type Glide = { readonly from: number; readonly to: number; readonly at: number };

/** The domain's update glide: both ends on one glide. */
type DomainGlide = {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly at: number;
};

function glideAt(glide: Glide, time: number): number {
  return updateTween(glide.from, glide.to, glide.at, time);
}

function domainAt(glide: DomainGlide, time: number): readonly [number, number] {
  const low = updateTween(glide.from[0], glide.to[0], glide.at, time);
  const high = updateTween(glide.from[1], glide.to[1], glide.at, time);
  return low === glide.to[0] && high === glide.to[1] ? glide.to : [low, high];
}

function sameRange(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** A value at rest. */
function still(value: number): Glide {
  return { from: value, to: value, at: Number.NEGATIVE_INFINITY };
}

/** A domain at rest. */
function resting(domain: readonly [number, number]): DomainGlide {
  return { from: domain, to: domain, at: Number.NEGATIVE_INFINITY };
}

/** The domain of a chart with no reading. */
const EMPTY_DOMAIN: readonly [number, number] = [0, 1];

/** What the last frame drew: the latest reading, which tells a new reading from a corrected one, and the tip's glide. */
type Drawn = { readonly newest: LivePoint; readonly tip: Glide };

/**
 * Create a chart's clock. Its first frame rests at the latest reading, which the server and a
 * hydrating render read too, and it moves once its owner sets a mode. A clock first set to
 * "paused" holds that frame.
 *
 * @param host - The frames, the frame clock and the wall clock.
 * @param initial - The first feed.
 * @returns The clock.
 */
export function createLiveClock(host: LiveClockHost, initial: LiveFeed): LiveClock {
  let feed = initial;
  // No mode until the owner sets one, so the first "still" redraws at the wall clock.
  let mode: LiveMode | null = null;
  let visible = true;
  let handle: number | null = null;
  let domain = resting(EMPTY_DOMAIN);
  // What the last frame drew, or null when it drew no reading.
  let drawn: Drawn | null = null;
  // The readings that glide to their own value, by time, each on its own glide.
  const settling = new Map<number, Glide>();
  const listeners = new Set<() => void>();
  const latest = (): number | null => feed.points.at(-1)?.time ?? null;

  /**
   * Move every glide on toward the feed: the clock's one change of state between frames. Every
   * reading still on its way, and the one the last frame ended on, moves from where it shows to its
   * value now, so a correction that arrives with a newer reading glides too, and a new reading grows
   * out of where the line ended. A glide that has ended or shows its target already, a reading the
   * feed dropped, and one before the window's entering reading, which no frame draws, leave. No
   * glide restarts on a newer reading, so at most the readings of one update duration glide,
   * however fast they arrive.
   */
  const retarget = (
    last: Drawn,
    newest: LivePoint,
    tip: number,
    fit: readonly [number, number],
    span: LiveSpan,
    time: number
  ): Drawn => {
    const { points } = feed;
    for (const [at, glide] of settling) {
      const value = points[indexAt(points, at)]?.value;
      if (value !== undefined && value !== glide.to) {
        settling.set(at, { from: glideAt(glide, time), to: value, at: time });
      }
    }
    const ended = points[indexAt(points, last.newest.time)];
    if (ended !== undefined && ended.value !== last.newest.value && !settling.has(ended.time)) {
      settling.set(ended.time, { from: last.newest.value, to: ended.value, at: time });
    }
    if (newest.time !== last.newest.time) {
      settling.set(newest.time, { from: glideAt(last.tip, time), to: newest.value, at: time });
    }
    const oldest = points[Math.max(0, span.first - 1)]?.time ?? Number.POSITIVE_INFINITY;
    for (const [at, glide] of settling) {
      const settled = time - glide.at >= CHART_UPDATE_MS || glideAt(glide, time) === glide.to;
      if (settled || at < oldest || indexAt(points, at) === -1) settling.delete(at);
    }
    if (!sameRange(fit, domain.to)) domain = { from: domainAt(domain, time), to: fit, at: time };
    const tipGlide = last.tip.to === tip ? last.tip : { from: glideAt(last.tip, time), to: tip, at: time };
    return { newest, tip: tipGlide };
  };

  /** The value each gliding reading shows at a time, by its time. */
  const heldAt = (time: number): ReadonlyMap<number, number> => {
    const held = new Map<number, number>();
    for (const [at, glide] of settling) held.set(at, glideAt(glide, time));
    return held;
  };

  /** The frame at a clock reading, gliding the domain to fit what its window shows. */
  const compose = (now: number, time: number, glides: boolean): LiveFrame => {
    const { points, tip: target } = feed;
    const window = windowEndingAt(now, feed.duration);
    const span = visibleSpan(points, window);
    const newest = points.at(-1);
    if (newest === undefined || target === null) {
      // With no reading the frame draws nothing, and the domain rests where it showed.
      domain = resting(domainAt(domain, time));
      drawn = null;
      settling.clear();
      return { feed, now, window, span, domain: domain.to, tip: null, held: new Map(), vertices: [] };
    }
    const fit = liveDomain(liveExtent(points, span, target));
    if (!glides || drawn === null) {
      // Without motion, or with nothing drawn to glide from, everything rests on its target.
      domain = resting(fit);
      settling.clear();
      drawn = { newest, tip: still(target) };
    } else {
      drawn = retarget(drawn, newest, target, fit, span, time);
    }
    const held = heldAt(time);
    const tip = glideAt(drawn.tip, time);
    const vertices = liveVertices(points, span, now, tip, held);
    // The domain a frame shows holds every value it draws: the readings at the values they show,
    // the entering one among them, and the tip. It widens to them at once and only eases inward, so
    // no glide, batch or dropped reading ever draws a mark outside the plot.
    const showing = domainAt(domain, time);
    const widened = valueRange(vertices, 0, vertices.length, [
      Math.min(showing[0], tip),
      Math.max(showing[1], tip),
    ]);
    const shown = widened[0] === showing[0] && widened[1] === showing[1] ? showing : widened;
    // A widened domain is what the frame showed, so the glide goes on from it: a value that leaves
    // eases the domain back in rather than snapping it.
    if (shown !== showing) domain = { from: shown, to: domain.to, at: time };
    return { feed, now, window, span, domain: shown, tip, held, vertices };
  };

  // The first frame rests at the latest reading, so the server and every browser draw it alike.
  let frame = compose(latest() ?? 0, 0, false);

  const show = (next: LiveFrame): void => {
    frame = next;
    for (const listener of listeners) listener();
  };

  /** The wall clock, never behind the latest reading, so a reading never lies past the right edge. */
  const wallNow = (): number => Math.max(host.epoch(), latest() ?? Number.NEGATIVE_INFINITY);

  /** Redraw the feed at the wall clock with no motion, as a still clock and a first reading do. */
  const redraw = (): void => {
    show(compose(wallNow(), host.now(), false));
  };

  const tick = (): void => {
    handle = null;
    show(compose(wallNow(), host.now(), true));
    schedule();
  };

  function schedule(): void {
    // The loop ends once the last part unsubscribes, as an unmount does, and a remount resumes it.
    const runs = mode === "live" && visible && listeners.size > 0;
    if (runs && handle === null) handle = host.requestFrame(tick);
    if (!runs && handle !== null) {
      host.cancelFrame(handle);
      handle = null;
    }
  }

  return {
    get: () => frame,
    subscribe(listener) {
      listeners.add(listener);
      schedule();
      return () => {
        listeners.delete(listener);
        schedule();
      };
    },
    feed(next) {
      const wasEmpty = feed.points.length === 0;
      feed = next;
      // A live clock draws the feed in its next frame, and a paused one holds its frame.
      if (mode === "still" || (mode === "live" && wasEmpty)) redraw();
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (mode === "still") redraw();
      schedule();
    },
    setVisible(next) {
      visible = next;
      schedule();
    },
  };
}
