import { nextFrames } from "./animation-frames";

/** What `expectStableBoxes` samples and when it gives up. */
export type StableBoxesOptions = {
  /** How many animation frames to sample. @default 30 */
  readonly frames?: number;
  /**
   * The test's abort signal (Vitest's test context `signal`). A test that timed out stops sampling
   * at its next frame instead of running on into the next test.
   */
  readonly signal?: AbortSignal;
};

/**
 * Assert that elements hold still: their boxes, the page's scroll and the visual viewport stay the
 * same over animation frames. It measures what Playwright's "stable" actionability check measures
 * (a box unchanged between frames), but over a longer window and with the evidence in the failure:
 * each frame's boxes, `scrollY` and the visual viewport's offset and scale. A test that presses
 * something that must not move asserts this first, so a real repositioning loop fails here with its
 * samples instead of as a click timeout.
 *
 * An element that leaves the document is not still, it is gone: its box would read 0×0 at 0,0 on
 * every frame and pass as still, so the check fails instead. With `signal`, a test that timed out
 * stops at its next frame, so a late continuation cannot act on the next test's page (a
 * timed-out test's leftover tap at 0,0 once closed the next test's popup).
 *
 * @param elements - The elements, by the name the failure prints.
 * @param options - The frame count and the test's abort signal.
 * @returns The boxes of the last frame, by name.
 */
export async function expectStableBoxes(
  elements: Readonly<Record<string, Element>>,
  options: StableBoxesOptions = {}
): Promise<Record<string, DOMRect>> {
  const { frames = 30, signal } = options;
  const samples: string[] = [];
  let last: Record<string, DOMRect> = {};
  for (let frame = 0; frame < frames; frame += 1) {
    await nextFrames(1);
    signal?.throwIfAborted();
    const gone = Object.entries(elements).filter(([, element]) => !element.isConnected);
    if (gone.length > 0) {
      throw new Error(
        `Expected the elements to hold still, but ${gone.map(([name]) => name).join(", ")} left the document at frame ${String(frame)}:\n${samples.join("\n")}`
      );
    }
    last = Object.fromEntries(
      Object.entries(elements).map(([name, element]) => [name, element.getBoundingClientRect()])
    );
    const viewport = window.visualViewport;
    samples.push(
      [
        ...Object.entries(last).map(
          ([name, box]) =>
            `${name} ${String(box.x)},${String(box.y)} ${String(box.width)}×${String(box.height)}`
        ),
        `scrollY ${String(window.scrollY)}`,
        `viewport ${String(viewport?.offsetTop)},${String(viewport?.offsetLeft)} ×${String(viewport?.scale)}`,
      ].join(" | ")
    );
  }
  const moved = samples.some((sample) => sample !== samples[0]);
  if (moved) {
    throw new Error(
      `Expected the elements to hold still for ${String(frames)} frames:\n${samples.join("\n")}`
    );
  }
  return last;
}
