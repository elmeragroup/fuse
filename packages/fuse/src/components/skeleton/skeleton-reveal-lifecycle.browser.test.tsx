import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import {
  LONG,
  heightAnimation,
  renderInvoice,
  scriptAnimations,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";

failOnResizeObserverLoop();

describe("SkeletonReveal onReveal", () => {
  it("calls onReveal only for a reveal that completes while it is current", async () => {
    let revealed = 0;
    const { show } = renderInvoice(null, { onReveal: () => (revealed += 1) });
    await nextFrames(2);
    show(LONG);
    await wait(50);
    // Back to loading while the content is still fading in.
    show(LONG, true);
    await wait(600);
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
    await wait(50);
    unmount();
    await wait(600);
    expect(revealed).toBe(0);
    expect([...running, rootEase].map((animation) => animation?.playState)).toEqual(
      [...running, rootEase].map(() => "idle")
    );
  });
});
