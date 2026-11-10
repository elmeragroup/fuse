import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  LONG,
  heightAnimation,
  renderInvoice,
  scriptAnimations,
  slot,
  failOnResizeObserverLoop,
  finishAnimations,
} from "../../../test/skeleton-reveal-fixtures";

failOnResizeObserverLoop();

describe("SkeletonReveal onReveal", () => {
  it("calls onReveal only for a reveal that completes while it is current", async () => {
    let revealed = 0;
    const { show } = renderInvoice(null, { onReveal: () => (revealed += 1) });
    await nextFrames(2);
    show(LONG);
    // Paused, the content is still fading in when the data goes back to loading.
    const stale = scriptAnimations(slot("skeleton-reveal"));
    expect(stale.length).toBeGreaterThan(0);
    for (const animation of stale) animation.pause();
    show(LONG, true);
    await nextFrames(2);
    // Every animation on the page runs to its end, the stale reveal's included.
    finishAnimations();
    await nextFrames(2);
    expect(revealed).toBe(0);
  });

  it("calls no onReveal and leaves no animation running once unmounted mid-reveal", async () => {
    let revealed = 0;
    const { show, unmount } = renderInvoice(null, { onReveal: () => (revealed += 1) });
    await nextFrames(2);
    show(LONG);
    const running = scriptAnimations(slot("skeleton-reveal"));
    const rootEase = heightAnimation(slot("skeleton-reveal"));
    expect(running.length).toBeGreaterThan(0);
    unmount();
    // Canceled, each animation rejects its `finished`, so no reveal can complete later.
    await nextFrames(2);
    expect(revealed).toBe(0);
    expect([...running, rootEase].map((animation) => animation?.playState)).toEqual(
      [...running, rootEase].map(() => "idle")
    );
  });
});
