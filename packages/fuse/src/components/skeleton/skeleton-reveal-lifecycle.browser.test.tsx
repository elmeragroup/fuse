import { Activity, Suspense } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

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
import {
  InvoiceCard,
  SAMPLE,
  createSuspender,
  currentPane,
  querySlot,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

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

describe("SkeletonReveal outgoing panes", () => {
  it("keeps the outgoing ghost's children when the children change as loading clears", () => {
    const view = (loading: boolean, text: string) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="together">
        <p>{text}</p>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true, "Balance 0 kr"));
    rerender(view(false, "Balance 1200 kr"));
    expect(slot("skeleton-reveal-ghost").textContent).toBe("Balance 0 kr");
    expect(slot("skeleton-reveal-content").textContent).toBe("Balance 1200 kr");
  });
});

describe("SkeletonReveal under Suspense and Activity", () => {
  it("finishes a reveal that Suspense hid mid-fade once the boundary shows again, and calls onReveal once", async () => {
    let revealed = 0;
    const { Suspender, release } = createSuspender();
    const view = (data: Invoice | null, suspend: boolean) => (
      <Suspense fallback={<p>Waiting</p>}>
        <Suspender suspend={suspend} />
        <SkeletonReveal
          data={data}
          sample={SAMPLE}
          label="Henter"
          reveal="together"
          onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </Suspense>
    );
    const { rerender } = renderThemed(view(null, false));
    await nextFrames(2);
    rerender(view(LONG, false));
    expect(querySlot("skeleton-reveal-skeleton")).not.toBeNull();
    // A sibling suspends while the skeleton is still fading out.
    rerender(view(LONG, true));
    await expect.poll(() => page.getByText("Waiting").query()).not.toBeNull();
    release();
    await expect.poll(() => page.getByText("Waiting").query()).toBeNull();
    // Each poll runs the reveal's animations to their end, so the fade takes no clock time.
    await expect
      .poll(() => {
        finishAnimations();
        return querySlot("skeleton-reveal-skeleton");
      })
      .toBeNull();
    const root = slot("skeleton-reveal");
    expect(root.style.overflow).toBe("");
    expect(root.offsetHeight).toBe(currentPane("skeleton-reveal-content", root).offsetHeight);
    expect(roleNamed("button", "Pay Invoice 4711")).toBeInstanceOf(HTMLButtonElement);
    await nextFrames(3);
    expect(revealed).toBe(1);
  });

  it("finishes a reveal that a hidden Activity interrupted once it is visible again", async () => {
    let revealed = 0;
    const view = (data: Invoice | null, hidden: boolean) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <SkeletonReveal
          data={data}
          sample={SAMPLE}
          label="Henter"
          reveal="together"
          onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </Activity>
    );
    const { rerender } = renderThemed(view(null, false));
    await nextFrames(2);
    rerender(view(LONG, false));
    rerender(view(LONG, true));
    await nextFrames(2);
    rerender(view(LONG, false));
    // Each poll runs the reveal's animations to their end, so the fade takes no clock time.
    await expect
      .poll(() => {
        finishAnimations();
        return querySlot("skeleton-reveal-skeleton");
      })
      .toBeNull();
    expect(slot("skeleton-reveal").style.overflow).toBe("");
    await nextFrames(3);
    expect(revealed).toBe(1);
  });

  it("drops a pending reveal that a load replaced while an Activity hid it", async () => {
    let revealed = 0;
    const view = (data: Invoice | null, hidden: boolean, loading = false) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <SkeletonReveal
          data={data}
          sample={SAMPLE}
          label="Henter"
          reveal="together"
          loading={loading}
          onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </Activity>
    );
    const { rerender } = renderThemed(view(null, false));
    await nextFrames(2);
    rerender(view(LONG, false));
    // Hidden mid-fade, then loading again before it shows: the reveal was replaced, never seen.
    rerender(view(LONG, true));
    await nextFrames(2);
    rerender(view(LONG, true, true));
    await nextFrames(2);
    rerender(view(LONG, false, true));
    await nextFrames(3);
    expect(slot("skeleton-reveal").getAttribute("aria-busy")).toBe("true");
    // Every animation run to its end: a reveal still pending would report now.
    finishAnimations();
    await nextFrames(2);
    expect(revealed).toBe(0);
  });

  it("shows a skeleton hidden during its first hold at once when it shows again, without holding it again", async () => {
    // Still loading throughout: no data arrives.
    const view = (hidden: boolean, data: Invoice | null = null) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <SkeletonReveal data={data} sample={SAMPLE} label="Henter">
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </Activity>
    );
    const { rerender } = renderThemed(view(false));
    const skeleton = slot("skeleton-reveal-skeleton");
    // Held: the smart mode keeps a client skeleton back for 150 ms. Paused, the hold is still
    // running when the Activity hides it, however slowly the runner renders.
    expect(getComputedStyle(skeleton).opacity).toBe("0");
    for (const animation of skeleton.getAnimations()) animation.pause();
    rerender(view(true));
    await nextFrames(2);
    rerender(view(false));
    expect(getComputedStyle(skeleton).opacity).toBe("1");
    expect(scriptAnimations(skeleton)).toEqual([]);
    finishAnimations();
    await nextFrames(2);
    expect(getComputedStyle(skeleton).opacity).toBe("1");
  });

  it("reports content that came back over a skeleton within one hidden Activity once it shows", async () => {
    let revealed = 0;
    const view = (loading: boolean, hidden: boolean) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <SkeletonReveal
          data={LONG}
          sample={SAMPLE}
          label="Henter"
          reveal="together"
          loading={loading}
          onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </Activity>
    );
    const { rerender } = renderThemed(view(false, false));
    await nextFrames(2);
    rerender(view(false, true));
    await nextFrames(2);
    // A whole refetch while hidden: the skeleton went up and the content came back over it.
    rerender(view(true, true));
    await nextFrames(2);
    rerender(view(false, true));
    await nextFrames(2);
    expect(revealed).toBe(0);
    rerender(view(false, false));
    await nextFrames(3);
    expect(slot("skeleton-reveal").getAttribute("aria-busy")).toBe("false");
    expect(revealed).toBe(1);
    finishAnimations();
    await nextFrames(2);
    expect(revealed).toBe(1);
  });

  /** What `onReveal` sees: the root's height, the content pane's height and how many panes are left. */
  type RevealLayout = { readonly root: number; readonly content: number; readonly panes: number };

  function layoutAtReveal(): RevealLayout {
    const root = slot("skeleton-reveal");
    // The reveal's panes have no role; every one of them is the root's child.
    const panes = [...root.querySelectorAll<HTMLElement>(":scope > [data-slot^='skeleton-reveal-']")].filter(
      (pane) => pane.dataset.slot !== "skeleton-reveal-label"
    );
    return {
      root: root.offsetHeight,
      content: currentPane("skeleton-reveal-content", root).offsetHeight,
      panes: panes.length,
    };
  }

  it.each([
    ["a reveal settled after a hidden refetch", true],
    ["an animated reveal", false],
  ] as const)(
    "calls onReveal on the final layout for %s: one pane, the content's height",
    async (_name, hidden) => {
      const seen: RevealLayout[] = [];
      const view = (loading: boolean, hiddenNow: boolean) => (
        <Activity mode={hiddenNow ? "hidden" : "visible"}>
          <SkeletonReveal
            loading={loading}
            label="Henter"
            reveal="together"
            onReveal={() => seen.push(layoutAtReveal())}>
            <div style={{ width: 288, height: 100 }}>Balance 1200 kr</div>
          </SkeletonReveal>
        </Activity>
      );
      const { rerender } = renderThemed(view(!hidden, false));
      await nextFrames(2);
      if (hidden) {
        rerender(view(false, true));
        await nextFrames(2);
        rerender(view(true, true));
        await nextFrames(2);
        rerender(view(false, true));
        await nextFrames(2);
        rerender(view(false, false));
      } else {
        // Up past the smart hold would not matter here: together always fades.
        rerender(view(false, false));
      }
      await expect
        .poll(() => {
          finishAnimations();
          return seen.length;
        })
        .toBe(1);
      expect(seen).toEqual([{ root: 100, content: 100, panes: 1 }]);
    }
  );

  it.each(["together", "sequence"] as const)(
    "calls onReveal only once the root has eased to taller content's height in a %s reveal",
    async (reveal) => {
      type Seen = {
        readonly root: number;
        readonly content: number;
        readonly overflow: string;
        readonly easing: boolean;
      };
      const seen: Seen[] = [];
      const view = (data: { readonly height: number } | null) => (
        <SkeletonReveal
          data={data}
          sample={{ height: 100 }}
          label="Henter"
          reveal={reveal}
          onReveal={() => {
            const root = slot("skeleton-reveal");
            seen.push({
              root: root.offsetHeight,
              content: currentPane("skeleton-reveal-content", root).offsetHeight,
              overflow: root.style.overflow,
              easing: heightAnimation(root) !== undefined,
            });
          }}>
          {(shown) => <div style={{ width: 288, height: shown.height }}>Balance 1200 kr</div>}
        </SkeletonReveal>
      );
      const { rerender } = renderThemed(view(null));
      await nextFrames(2);
      rerender(view({ height: 400 }));
      expect(heightAnimation(slot("skeleton-reveal"))).toBeDefined();
      await expect
        .poll(() => {
          finishAnimations();
          return seen.length;
        })
        .toBe(1);
      expect(seen).toEqual([{ root: 400, content: 400, overflow: "", easing: false }]);
    }
  );
});
