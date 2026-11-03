import { useEffect, useLayoutEffect, useRef } from "react";

import type { FrameClock, RenderHold } from "./frame-clock";

/**
 * The attribute a motion host carries: the milliseconds since its last state change. Every CSS
 * animation and transition whose target sits inside the host is seeked to that time.
 */
export const MOTION_ELAPSED_ATTRIBUTE = "data-motion-elapsed";

/** Present on a motion host while it replays an earlier state before the frame's own. */
export const MOTION_PRIMING_ATTRIBUTE = "data-motion-priming";

/** Present on a motion host while its overlay is open, so the page is unsettled until the popup is. */
export const MOTION_OPEN_ATTRIBUTE = "data-motion-open";

/**
 * A page still on its way to the frame: a host replaying, a host whose open popup has not mounted
 * or still wears its starting style, or any element Base UI is about to start a transition from.
 */
const UNSETTLED = [
  `[${MOTION_PRIMING_ATTRIBUTE}]`,
  `[${MOTION_OPEN_ATTRIBUTE}]:not(:has([data-open]))`,
  "[data-starting-style]",
].join(", ");

/** Settle rounds before a frame gives up waiting for the page to stop changing. */
const MAX_ROUNDS = 24;

/** Consecutive unchanged rounds that count as settled. */
const STABLE_ROUNDS = 3;

/** The DOM changes that can start a CSS animation or transition: a mount, a class or a state flag. */
const MOTION_CHANGES: MutationObserverInit = { subtree: true, childList: true, attributes: true };

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
}

/** The motion host that owns an animation's target, if any. */
function hostOf(animation: Animation): Element | null {
  const effect = animation.effect;
  if (!(effect instanceof KeyframeEffect) || effect.target === null) {
    return null;
  }
  return effect.target.closest(`[${MOTION_ELAPSED_ATTRIBUTE}]`);
}

/**
 * Pauses one animation and seeks it. Inside a host it plays from the host's last change; an
 * animation past its end is finished, so a primitive awaiting `finished` can unmount. Outside a
 * host it follows the composition clock, so it still renders the same pixels for a frame.
 *
 * @returns Whether the call finished the animation.
 */
function seek(animation: Animation, compositionMs: number): boolean {
  animation.pause();
  const host = hostOf(animation);
  if (host === null) {
    animation.currentTime = compositionMs;
    return false;
  }
  const elapsed = Number(host.getAttribute(MOTION_ELAPSED_ATTRIBUTE));
  // A CSS animation's end time is a plain number of milliseconds; an infinite one never ends.
  const end = Number(animation.effect?.getComputedTiming().endTime ?? Number.POSITIVE_INFINITY);
  if (Number.isFinite(end) && elapsed >= end) {
    animation.finish();
    return true;
  }
  animation.currentTime = elapsed;
  return false;
}

/**
 * Seeks every animation on the page once.
 *
 * @returns Whether the pass finished any animation.
 */
function seekAll(compositionMs: number): boolean {
  return document
    .getAnimations()
    .map((animation) => seek(animation, compositionMs))
    .includes(true);
}

/**
 * Runs `onChange` after every DOM change, in the task that made it. A motion started during an
 * animation frame's work takes that frame's time as its start, but Chromium reports it, and a
 * `requestAnimationFrame` callback sees it, only on the next frame. On a slow machine the work in
 * between can outlast a short motion, which has then run to its end: a transition leaves
 * `getAnimations()` for good, and an exit lets Base UI unmount its popup. An observer runs before
 * that frame, and `getAnimations()` creates the motion as it reads the style, so a pass from here
 * holds it at the frame's time.
 *
 * @returns A function that stops watching.
 */
function watchChanges(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document, MOTION_CHANGES);
  return () => {
    observer.disconnect();
  };
}

/**
 * Seeks every animation on the page, round after round. It stops after `STABLE_ROUNDS` rounds in a row
 * that finish nothing, see the same number of animations as the round before and find nothing
 * that `UNSETTLED` matches. Base UI mounts a popup over several renders and starts its
 * transitions an animation frame after mount, and an exit unmounts only after its animations
 * finish, so one pass is not enough. A first pass runs at once, for the motion the caller's
 * change started, and every DOM change during the rounds runs another before the next frame, so
 * a motion is held from its start however slowly the machine runs.
 *
 * @param compositionMs - The frame's time on the composition clock, for animations outside a host.
 * @param isActive - Whether the caller still wants the result; a newer frame stops the rounds.
 * @returns Once the page has settled or the round limit is reached.
 */
export async function settleAnimations(
  compositionMs: number,
  isActive: () => boolean = () => true
): Promise<void> {
  const stopWatching = watchChanges(() => {
    if (isActive()) {
      seekAll(compositionMs);
    }
  });
  seekAll(compositionMs);
  try {
    await seekRounds(compositionMs, isActive);
  } finally {
    stopWatching();
  }
}

/** The settle rounds of {@link settleAnimations}, one per animation frame. */
async function seekRounds(compositionMs: number, isActive: () => boolean): Promise<void> {
  let stable = 0;
  let previousCount = -1;
  for (let round = 0; round < MAX_ROUNDS && stable < STABLE_ROUNDS; round++) {
    await nextAnimationFrame();
    if (!isActive()) {
      return;
    }
    const animations = document.getAnimations();
    const finishedAny = animations.map((animation) => seek(animation, compositionMs)).includes(true);
    const unsettled = document.querySelector(UNSETTLED) !== null;
    stable = finishedAny || unsettled || animations.length !== previousCount ? 0 : stable + 1;
    previousCount = animations.length;
  }
}

/**
 * Drives Fuse's CSS motion from the video frame. Render it once per scene, beside the content it
 * seeks and inside the same font gate, so it mounts and holds in the commit that mounts that
 * content. On every frame it holds the render, pauses every Web Animation on the page and seeks
 * it to the frame, then releases the render once the page settles.
 *
 * @param props.clock - The scene's frame.
 * @param props.hold - The render's holds.
 * @returns Nothing; the component only runs the effect.
 */
export function SeekCssAnimations({
  clock,
  hold,
}: {
  readonly clock: FrameClock;
  readonly hold: RenderHold;
}): null {
  const { frame, fps } = clock;
  const { delayRender, continueRender } = hold;
  const compositionMs = useRef(0);

  // A motion that starts after the frame settled, such as one a primitive starts from a timer,
  // would otherwise run on the wall clock until the screenshot. It is seeked as it starts.
  useEffect(
    () =>
      watchChanges(() => {
        seekAll(compositionMs.current);
      }),
    []
  );

  useLayoutEffect(() => {
    compositionMs.current = (frame / fps) * 1000;
    const handle = delayRender(`Seeking CSS animations to frame ${String(frame)}`);
    let active = true;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    void settleAnimations(compositionMs.current, () => active).then(release);
    return () => {
      active = false;
      release();
    };
  }, [frame, fps, delayRender, continueRender]);

  return null;
}
