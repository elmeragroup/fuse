/**
 * Unit under test: how SkeletonReveal's panes take part in scroll anchoring, in every engine, since
 * each engine picks its own anchor. Oracles: the leaving pane's place before the swap, which it must
 * keep, and the growth of content above the reader's place, by which an anchoring scroll container
 * moves its scroll offset.
 */
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { currentPane, slot, failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

describe("SkeletonReveal scroll anchoring", () => {
  it("keeps a leaving pane where it stood in a scrolled root", async () => {
    const view = (loading: boolean, label: string) => (
      <SkeletonReveal
        loading={loading}
        label="Henter"
        reveal="together"
        style={{ height: 150, overflow: "auto" }}>
        <div style={{ width: 288, height: 400 }}>{label}</div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(false, "Balance"));
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    root.scrollTop = 50;
    await nextFrames(2);
    // A commit while scrolled, which the reveal tracks its pane's box at.
    rerender(view(false, "Balance 1200 kr"));
    await nextFrames(2);
    const pane = currentPane("skeleton-reveal-content", root);
    const before = pane.getBoundingClientRect();
    expect(root.scrollTop).toBe(50);
    rerender(view(true, "Balance 1200 kr"));
    expect(pane.hasAttribute("data-exiting")).toBe(true);
    expect(root.scrollTop).toBe(50);
    const during = pane.getBoundingClientRect();
    expect({ top: during.top, left: during.left, width: during.width, height: during.height }).toEqual({
      top: before.top,
      left: before.left,
      width: before.width,
      height: before.height,
    });
  });

  it.runIf(CSS.supports("overflow-anchor", "auto"))(
    "keeps the reader's place in settled content when content above it grows",
    async () => {
      const view = (above: number) => (
        <div data-probe="scroller" style={{ height: 150, overflow: "auto" }}>
          <SkeletonReveal loading={false} label="Henter" reveal="together">
            <div style={{ width: 288 }}>
              <div style={{ height: above }} />
              {["Due 4 May", "Electricity 812 kr", "Grid rent 344 kr", "Fees 39 kr", "Total 1195 kr"].map(
                (line) => (
                  <p key={line} style={{ height: 60, margin: 0 }}>
                    {line}
                  </p>
                )
              )}
            </div>
          </SkeletonReveal>
        </div>
      );
      const { rerender } = renderThemed(view(100));
      await nextFrames(2);
      // DOM audit: the scroll container is the test's own wrapper, which the probe marks.
      const scroller = document.querySelector<HTMLElement>('[data-probe="scroller"]');
      if (scroller === null) throw new Error("expected the scroll container");
      scroller.scrollTop = 200;
      await nextFrames(2);
      expect(scroller.scrollTop).toBe(200);
      // 40 px more above the viewport: the line in view stays in view, 40 px further down.
      rerender(view(140));
      await nextFrames(2);
      expect(scroller.scrollTop).toBe(240);
    }
  );
});
