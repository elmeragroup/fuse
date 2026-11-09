import { page } from "vitest/browser";

import { nextFrames } from "./animation-frames";

/** How many rendered frames a popup gets to finish opening before the wait fails. */
const OPENING_FRAMES = 120;

/**
 * Wait until the open popup (`role="dialog"`) has finished opening, so a pointer press can land on
 * what is inside it. Base UI marks an opening popup `data-open` and drops `data-starting-style` a
 * frame after mount; the enter animation runs after that. Playwright refuses a target that is still
 * moving, so tests that open a popup and then press inside it wait for the attributes and every
 * running animation.
 *
 * The wait counts rendered frames, not milliseconds: the attribute goes a frame after mount however
 * long that frame takes, and in GPU-less WebKit the first frames after a popup opens are slow
 * (#541), longer than a wall-clock poll allowed. With `signal`, a test
 * that timed out stops at its next frame.
 *
 * @param options - The test's abort signal.
 * @returns The popup.
 */
export async function waitForPopupSettled(
  options: { readonly signal?: AbortSignal } = {}
): Promise<HTMLElement> {
  for (let frame = 0; frame < OPENING_FRAMES; frame += 1) {
    const element = page.getByRole("dialog").query();
    if (
      element instanceof HTMLElement &&
      element.hasAttribute("data-open") &&
      !element.hasAttribute("data-starting-style")
    ) {
      // An animation canceled by a close rejects `finished`; the popup is then no longer opening.
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))
      );
      return element;
    }
    await nextFrames(1);
    options.signal?.throwIfAborted();
  }
  throw new Error(`Expected a popup to finish opening within ${String(OPENING_FRAMES)} frames.`);
}
