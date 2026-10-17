import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode, RefObject } from "react";

import type { FrameClock } from "./frame-clock";
import {
  MOTION_ELAPSED_ATTRIBUTE,
  MOTION_OPEN_ATTRIBUTE,
  MOTION_PRIMING_ATTRIBUTE,
} from "./seek-css-animations";

/**
 * How long after a change a part's motion can still be running. It covers every Fuse open and
 * close, the longest of which is the Sheet's 200 ms, and a toast's entrance.
 */
const MOTION_WINDOW_SECONDS = 1;

/** Any motion has ended this many milliseconds after its change. */
const SETTLED_MS = 60_000;

/**
 * Whether a part whose motion starts on `since` may still be moving on the clock's frame.
 *
 * @param clock - The part's frame.
 * @param since - The frame its motion starts on.
 * @returns True from `since` until the motion window has passed.
 */
function inMotion(clock: FrameClock, since: number): boolean {
  const into = clock.frame - since;
  return into >= 0 && into < MOTION_WINDOW_SECONDS * clock.fps;
}

/**
 * The milliseconds since a part's motion started, the time its motion host carries.
 *
 * @param clock - The part's frame.
 * @param since - The frame its motion starts on.
 * @returns The elapsed time, negative before `since`.
 */
export function elapsedMs(clock: FrameClock, since: number): number {
  return ((clock.frame - since) / clock.fps) * 1000;
}

/**
 * A remount key for a part whose motion starts on `since`. A render can rewind, as Studio does
 * when it scrubs back, into motion that already ran to its end; a finished CSS transition or
 * animation is gone and cannot be seeked back. The key changes on every backward step into the
 * motion window, so a part keyed by it mounts fresh and runs its motion again from the start,
 * as a render that began on that frame does. Forward playback keeps the key.
 *
 * @param clock - The caller's frame and frame rate.
 * @param since - The frame the motion starts on.
 * @returns A number that changes on each rewind into the motion.
 */
export function useRewindGeneration(clock: FrameClock, since: number): number {
  const [history, setHistory] = useState({ last: clock.frame, generation: 0 });
  if (history.last === clock.frame) {
    return history.generation;
  }
  const rewound = clock.frame < history.last && inMotion(clock, since);
  const next = { last: clock.frame, generation: history.generation + (rewound ? 1 : 0) };
  // React's derived-state pattern: the update re-renders this component before its children.
  setHistory(next);
  return next.generation;
}

/** Whether a host holds no popup, no starting or ending style and no motion left to run. */
function isClosedAtRest(host: HTMLElement): boolean {
  return (
    host.querySelector("[data-open], [data-starting-style], [data-ending-style]") === null &&
    host.getAnimations({ subtree: true }).length === 0
  );
}

/** The overlay's controlled state and the element its content portals into. */
export type SeekedOverlayState = {
  /** Pass to the overlay root's `open`. */
  readonly open: boolean;
  /** Pass to the overlay content's `container`. */
  readonly container: RefObject<HTMLDivElement | null>;
};

/** Props for {@link SeekedOverlay}. */
export type SeekedOverlayProps = {
  /** The frame the overlay opens on. */
  readonly openAt: number;
  /**
   * The frame the overlay closes on, at once rather than through its closing motion: a render that
   * begins inside that motion could not show the popup it never opened. By default it stays open to
   * the end of the caller's timeline.
   */
  readonly closeAt?: number;
  readonly clock: FrameClock;
  /** Renders the overlay from its state. */
  readonly children: (overlay: SeekedOverlayState) => ReactNode;
};

/** One mount of an overlay: its open state, its replay and its motion host. */
function OverlayMount({
  openAt,
  closeAt = Number.POSITIVE_INFINITY,
  clock,
  children,
}: SeekedOverlayProps): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const opened = clock.frame >= openAt && clock.frame < closeAt;
  // Base UI animates only a change it sees, and it skips the opening motion of a popup that
  // mounts open. A mount inside the opening motion therefore starts closed, waits for that to
  // settle, and then opens.
  const [replaying, setReplaying] = useState(() => inMotion(clock, openAt));
  const open = opened && !replaying;

  useLayoutEffect(() => {
    if (!replaying) {
      return;
    }
    let request = 0;
    const waitForClosed = () => {
      if (container.current !== null && isClosedAtRest(container.current)) {
        setReplaying(false);
        return;
      }
      request = requestAnimationFrame(waitForClosed);
    };
    request = requestAnimationFrame(waitForClosed);
    return () => {
      cancelAnimationFrame(request);
    };
  }, [replaying]);

  // The host wraps the overlay's inline parts, such as a Select trigger whose chevron turns as it
  // opens, and the element its content portals into, so all of its motion runs from `openAt`.
  // `display: contents` keeps the host out of the layout; `closest()` still finds it.
  return (
    <div
      className="contents"
      // Before it opens, a rewind's close finishes at once: nothing on screen is mid-motion then.
      // React drops an attribute whose value is undefined, so each flag shows only while it holds.
      {...{
        [MOTION_ELAPSED_ATTRIBUTE]: open ? elapsedMs(clock, openAt) : SETTLED_MS,
        [MOTION_PRIMING_ATTRIBUTE]: replaying ? "" : undefined,
        [MOTION_OPEN_ATTRIBUTE]: open ? "" : undefined,
      }}>
      {children({ open, container })}
      <div ref={container} />
    </div>
  );
}

/**
 * Opens an overlay from the frame and times its motion. Its content must portal into the
 * `container` it hands out. Everything it renders, inline parts and portalled content alike, sits
 * in one motion host that `SeekCssAnimations` seeks from `openAt`.
 * Whatever order frames render in, fresh, played forward or rewound, a frame shows what a render
 * that began on that frame shows.
 *
 * A popup leaves focus where a fresh render of the frame leaves it, so its content passes
 * `finalFocus={false}`, and `initialFocus={false}` too when the popup would take focus and nothing
 * in the frame needs it. Focus that moved on an earlier frame leaves a focus ring that a render
 * starting on a later frame never draws.
 *
 * @returns The overlay and its motion host.
 */
export function SeekedOverlay(props: SeekedOverlayProps): ReactElement {
  const generation = useRewindGeneration(props.clock, props.openAt);
  return <OverlayMount key={generation} {...props} />;
}
