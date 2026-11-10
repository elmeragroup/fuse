import { expect, onTestFinished, vi } from "vitest";

/**
 * Waits for animation frames, so React renders what the last state change scheduled.
 *
 * @param count - How many frames to wait.
 * @returns The last frame's timestamp, as its frame callback reads it.
 */
export async function nextFrames(count = 1): Promise<number> {
  let now = performance.now();
  for (let frame = 0; frame < count; frame += 1) {
    now = await new Promise<number>((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
  return now;
}

/**
 * Fakes the page's timeouts for the rest of the current test, so a delay runs out only when the
 * test moves the clock, and restores the real ones when the test finishes. Animation frames stay
 * real. Call it in a test or a `beforeEach`.
 */
export function useFakeTimeouts(): void {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/**
 * Waits until the page has a fake timeout pending, checking once per animation frame. A component
 * that arms its next timeout in an effect commits the render that shows the last one's work first,
 * and the runner can render a frame between that commit and the effect, so a test that moves the
 * clock as soon as the render shows can move it past no timeout at all.
 */
export async function pendingTimeout(): Promise<void> {
  await pollFrames(() => vi.getTimerCount() > 0, true);
}

/**
 * Waits through at least `ms` milliseconds of animation frames, so every frame in between runs its
 * rendering steps.
 *
 * @param ms - The least time to wait, in milliseconds.
 */
export async function wait(ms: number): Promise<void> {
  const start = performance.now();
  do await nextFrames(1);
  while (performance.now() - start < ms);
}

/** The frames a poll waits by default: a second at 60 frames a second, as long as `expect.poll`. */
const POLL_FRAMES = 60;

/**
 * Wait until `read` holds, checking once per animation frame for at most `frames` frames, without
 * throwing, so a caller can name the step that missed and go on. A frame-exact step sees the state
 * on the frame it first holds, since the wait ends without running another frame.
 *
 * @param read - Reads whether the state holds, once per frame.
 * @param frames - The most frames to wait.
 * @returns Whether it held.
 */
async function framesUntil(read: () => boolean, frames: number): Promise<boolean> {
  for (let frame = 0; frame < frames; frame += 1) {
    if (read()) return true;
    await nextFrames(1);
  }
  return read();
}

/**
 * Wait until `read` returns `expected`, by `toEqual`, checking once per animation frame for at
 * most `frames` frames.
 *
 * A scroll, its `scrollend` and whatever the page renders in answer advance only as frames run,
 * and a loaded runner can stop rendering a page for seconds while its timers still fire. A poll
 * timed in milliseconds then runs out before one frame renders. Counted in frames, the budget is
 * what it was on a fast runner, and it pauses with the page on a starved one.
 *
 * @param read - Reads the state, once per frame.
 * @param expected - The state to wait for.
 * @param frames - The most frames to wait: 60 per second a millisecond poll would have waited.
 */
export async function pollFrames<T>(read: () => T, expected: T, frames = POLL_FRAMES): Promise<void> {
  if (await framesUntil(() => matches(read(), expected), frames)) return;
  expect(read()).toEqual(expected);
}

function matches<T>(actual: T, expected: T): boolean {
  try {
    expect(actual).toEqual(expected);
    return true;
  } catch {
    return false;
  }
}

/**
 * Records `read()` on every animation frame, from the next frame until `done()` holds or `ms` pass.
 * Start it before the action under test, unawaited, and await it after: the frames run in the page
 * whatever the action's round trip to the test runner costs, so a loaded runner whose command
 * returns after an exit has ended still sees every frame of it.
 *
 * @param read - What to record each frame.
 * @param done - Whether to stop, checked after each frame's reading.
 * @param ms - The most time to record for, in milliseconds.
 * @returns Every frame's reading, in order.
 */
export function recordFrames<T>(read: () => T, done: () => boolean, ms = 3000): Promise<T[]> {
  const frames: T[] = [];
  const start = performance.now();
  return new Promise((resolve) => {
    const tick = (): void => {
      frames.push(read());
      if (done() || performance.now() - start > ms) resolve(frames);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
