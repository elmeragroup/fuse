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
import { cubicBezier } from "./ease";
import { indexAt, liveDomain, liveExtent, liveVertices, visibleSpan, windowEndingAt } from "./live-window";
import type { LivePoint, LiveSpan, LiveTip, LiveWindow } from "./live-window";
import { CHART_UPDATE_CURVE, CHART_UPDATE_MS } from "./motion";

/** A host's frames, its frame clock, and the wall clock in epoch milliseconds. */
export type LiveClockHost = MotionHost & { readonly epoch: () => number };

/** What a frame draws. */
export type LiveFrame = {
  /**
   * The feed the frame draws, the same object until the clock takes another, which every readout
   * that names a reading reads, so a paused chart names what it shows.
   */
  readonly feed: LiveFeed;
  /** The feed's readings in time order, which `span` indexes. */
  readonly points: readonly LivePoint[];
  /** The clock, the window's end, in epoch milliseconds. */
  readonly now: number;
  readonly window: LiveWindow;
  /** The readings inside the window. */
  readonly span: LiveSpan;
  /** The value domain as it shows now. */
  readonly domain: readonly [number, number];
  /** The tip as it shows now, or null with no reading. */
  readonly tip: LiveTip | null;
  /** The value each gliding reading shows now, by its time: the live one and any still settling. */
  readonly held: ReadonlyMap<number, number>;
};

/** What the chart feeds its clock. */
export type LiveFeed = {
  /** The readings in time order. */
  readonly points: readonly LivePoint[];
  /** The latest value, or null with no reading. */
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

/** A glide of a number pair from one value to another, started at a frame-clock time. */
type Glide = {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly at: number;
};

const ease = cubicBezier(CHART_UPDATE_CURVE);

/** How far a glide that started `elapsed` milliseconds ago has come, on the update curve. */
function glideShare(elapsed: number): number {
  return ease(Math.max(0, Math.min(1, elapsed / CHART_UPDATE_MS)));
}

function glideAt(glide: Glide, time: number): readonly [number, number] {
  const share = glideShare(time - glide.at);
  if (share >= 1) return glide.to;
  return [
    glide.from[0] + (glide.to[0] - glide.from[0]) * share,
    glide.from[1] + (glide.to[1] - glide.from[1]) * share,
  ];
}

/** A glide restarted at `time` from where it shows, toward a new target. */
function rebase(glide: Glide, to: readonly [number, number], time: number): Glide {
  return { from: glideAt(glide, time), to, at: time };
}

/** A glide of one value, as a pair whose halves move together. */
function glideOne(from: number, to: number, time: number): Glide {
  return { from: [from, from], to: [to, to], at: time };
}

/** A domain widened to hold every value in a list. */
function holding(domain: readonly [number, number], values: Iterable<number>): readonly [number, number] {
  let [low, high] = domain;
  for (const value of values) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  return low === domain[0] && high === domain[1] ? domain : [low, high];
}

function samePair(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function rest(value: readonly [number, number]): Glide {
  return { from: value, to: value, at: Number.NEGATIVE_INFINITY };
}

/** The domain of a chart with no reading. */
const EMPTY_DOMAIN: readonly [number, number] = [0, 1];

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
  let domain = rest(EMPTY_DOMAIN);
  // The tip glides as a pair whose two halves move together, so it shares the domain's glide.
  let tip: Glide | null = null;
  // The readings that glide to their own value, by time, each on its own glide.
  const settling = new Map<number, Glide>();
  // The latest reading the last frame drew, which tells a new reading from a corrected one.
  let newestDrawn: LivePoint | null = null;
  const listeners = new Set<() => void>();
  const latest = (): number | null => feed.points.at(-1)?.time ?? null;

  /** The frame at a clock reading, gliding the domain to fit what its window shows. */
  const compose = (now: number, time: number, glides: boolean): LiveFrame => {
    const { points } = feed;
    const window = windowEndingAt(now, feed.duration);
    const span = visibleSpan(points, window);
    const extent = liveExtent(points, span, feed.tip);
    const target = extent === null ? domain.to : liveDomain(extent);
    const newest = points.at(-1) ?? null;
    if (!glides || feed.tip === null || tip === null || newestDrawn === null || newest === null) {
      // Without motion, or with nothing drawn to glide from, everything rests on its target.
      domain = rest(extent === null ? glideAt(domain, time) : target);
      tip = feed.tip === null ? null : rest([feed.tip, feed.tip]);
      settling.clear();
    } else {
      // Every reading still on its way, and the one the last frame ended on, moves from where it
      // shows to its value now, so a correction that arrives with a newer reading glides too.
      for (const [at, glide] of settling) {
        const value = points[indexAt(points, at)]?.value;
        if (value !== undefined && value !== glide.to[0]) {
          settling.set(at, glideOne(glideAt(glide, time)[0], value, time));
        }
      }
      const ended = points[indexAt(points, newestDrawn.time)];
      if (ended !== undefined && ended.value !== newestDrawn.value && !settling.has(ended.time)) {
        settling.set(ended.time, glideOne(newestDrawn.value, ended.value, time));
      }
      if (newest.time !== newestDrawn.time) {
        // A new reading grows out of where the line ended.
        settling.set(newest.time, glideOne(glideAt(tip, time)[0], newest.value, time));
      }
      if (tip.to[0] !== feed.tip) tip = rebase(tip, [feed.tip, feed.tip], time);
      if (!samePair(target, domain.to)) domain = rebase(domain, target, time);
    }
    newestDrawn = newest;
    // A glide that has ended or shows its target already, a reading the feed dropped, and one before
    // the window's entering reading, which no frame draws, leave. No glide restarts on a newer
    // reading, so at most the readings of one update duration glide, however fast they arrive.
    const oldest = points[Math.max(0, span.first - 1)]?.time ?? Number.POSITIVE_INFINITY;
    const held = new Map<number, number>();
    for (const [at, glide] of settling) {
      const value = glideAt(glide, time)[0];
      const settled = time - glide.at >= CHART_UPDATE_MS || value === glide.to[0];
      if (settled || at < oldest || indexAt(points, at) === -1) settling.delete(at);
      else held.set(at, value);
    }
    const shown = tip === null ? null : glideAt(tip, time)[0];
    const shownTip = feed.tip === null || shown === null ? null : { target: feed.tip, shown };
    // The domain a frame shows holds every value it draws: the readings at the values they show,
    // the entering one among them, and the tip. It widens to them at once and only eases inward, so
    // no glide, batch or dropped reading ever draws a mark outside the plot.
    const drawn = liveVertices(points, span, now, shownTip, held).map((vertex) => vertex.value);
    if (shown !== null) drawn.push(shown);
    const showing = glideAt(domain, time);
    const widened = holding(showing, drawn);
    // A widened domain is what the frame showed, so the glide goes on from it: a value that leaves
    // eases the domain back in rather than snapping it.
    if (widened !== showing) domain = { from: widened, to: domain.to, at: time };
    return {
      feed,
      points,
      now,
      window,
      span,
      domain: widened,
      tip: shownTip,
      held,
    };
  };

  // The first frame rests at the latest reading, so the server and every browser draw it alike.
  let frame = compose(latest() ?? 0, 0, false);

  const show = (next: LiveFrame): void => {
    frame = next;
    for (const listener of listeners) listener();
  };

  /** The wall clock, never behind the latest reading, so a reading never lies past the right edge. */
  const wallNow = (): number => Math.max(host.epoch(), latest() ?? Number.NEGATIVE_INFINITY);

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
      if (mode === "still") show(compose(wallNow(), host.now(), false));
      else if (mode === "live" && wasEmpty) show(compose(wallNow(), host.now(), false));
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      if (mode === "still") show(compose(wallNow(), host.now(), false));
      schedule();
    },
    setVisible(next) {
      visible = next;
      schedule();
    },
  };
}
