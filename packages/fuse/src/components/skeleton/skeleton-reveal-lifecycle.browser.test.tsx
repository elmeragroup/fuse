/**
 * Unit under test: SkeletonReveal across interruptions. Oracles: whether a reveal ran to its end
 * while it was the pane on screen, which alone reports `onReveal`; the outgoing pane's own text,
 * which it keeps while it leaves; and, after Suspense or a hidden Activity, the pane the reveal
 * must settle on, with nothing else left in its root.
 */
import { Activity, Suspense, useEffect, useState } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import {
  InvoiceCard,
  LONG,
  SAMPLE,
  createSuspender,
  currentPane,
  heightAnimation,
  querySlot,
  renderInvoice,
  scriptAnimations,
  slot,
  failOnResizeObserverLoop,
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

  it("keeps the outgoing ghost's render when the render function changes with the data", () => {
    const view = (data: Invoice | null, prefix: string) => (
      <SkeletonReveal data={data} sample={SAMPLE} label="Henter" reveal="together">
        {(invoice) => <p>{`${prefix} ${invoice.title}`}</p>}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null, "Sample"));
    rerender(view(LONG, "Shown"));
    expect(slot("skeleton-reveal-ghost").textContent).toBe("Sample Invoice 0000");
    expect(slot("skeleton-reveal-content").textContent).toBe("Shown Invoice 4711");
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
    await expect.poll(() => querySlot("skeleton-reveal-skeleton"), { timeout: 2000 }).toBeNull();
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
    await expect.poll(() => querySlot("skeleton-reveal-skeleton"), { timeout: 2000 }).toBeNull();
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
    await wait(400);
    expect(revealed).toBe(0);
  });

  it("settles straight to the current pane when an Activity shows again with a swap pending, leaving nothing below it", async () => {
    const view = (loading: boolean, hidden: boolean) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <SkeletonReveal loading={loading} label="Henter" reveal="together">
          <div style={{ width: 288, height: 100 }}>Balance 1200 kr</div>
        </SkeletonReveal>
      </Activity>
    );
    const { rerender } = renderThemed(view(false, false));
    await nextFrames(2);
    rerender(view(false, true));
    await nextFrames(2);
    rerender(view(true, true));
    await nextFrames(2);
    rerender(view(true, false));
    const root = slot("skeleton-reveal");
    const box = root.getBoundingClientRect();
    // DOM audit: the reveal's panes have no role; every one of them is the root's child.
    const panes = [...root.querySelectorAll<HTMLElement>(":scope > [data-slot^='skeleton-reveal-']")].filter(
      (pane) => pane.dataset.slot !== "skeleton-reveal-label"
    );
    expect(panes.map((pane) => pane.dataset.slot)).toEqual(["skeleton-reveal-skeleton"]);
    for (const pane of panes) {
      const rect = pane.getBoundingClientRect();
      expect(rect.top).toBeGreaterThanOrEqual(box.top - 0.5);
      expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
    }
    expect(heightAnimation(root)).toBeUndefined();
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
    // Held: the smart mode keeps a client skeleton back for 150 ms.
    expect(getComputedStyle(skeleton).opacity).toBe("0");
    await wait(50);
    rerender(view(true));
    await nextFrames(2);
    rerender(view(false));
    expect(getComputedStyle(skeleton).opacity).toBe("1");
    expect(scriptAnimations(skeleton)).toEqual([]);
    await wait(250);
    expect(getComputedStyle(skeleton).opacity).toBe("1");
  });

  it("settles to content that arrived while a first-rendered Activity was still hidden", async () => {
    const view = (data: Invoice | null, hidden: boolean) => (
      <Activity mode={hidden ? "hidden" : "visible"}>
        <SkeletonReveal data={data} sample={SAMPLE} label="Henter" reveal="together">
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </Activity>
    );
    const { rerender } = renderThemed(view(null, true));
    await nextFrames(2);
    rerender(view(LONG, true));
    await nextFrames(2);
    rerender(view(LONG, false));
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    // DOM audit: the reveal's panes have no role; every one of them is the root's child.
    const panes = [...root.querySelectorAll<HTMLElement>(":scope > [data-slot^='skeleton-reveal-']")]
      .map((pane) => pane.dataset.slot)
      .filter((name) => name !== "skeleton-reveal-label");
    expect(panes).toEqual(["skeleton-reveal-content"]);
    expect(root.offsetHeight).toBe(currentPane("skeleton-reveal-content", root).offsetHeight);
    expect(heightAnimation(root)).toBeUndefined();
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
    await wait(400);
    expect(revealed).toBe(1);
  });

  it("reports nothing for a hidden Activity that is still loading when it shows", async () => {
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
    rerender(view(true, true));
    await nextFrames(2);
    rerender(view(true, false));
    await nextFrames(3);
    expect(slot("skeleton-reveal").getAttribute("aria-busy")).toBe("true");
    await wait(400);
    expect(revealed).toBe(0);
  });

  /** What `onReveal` sees: the root's height, the content pane's height and how many panes are left. */
  type RevealLayout = { readonly root: number; readonly content: number; readonly panes: number };

  function layoutAtReveal(): RevealLayout {
    const root = slot("skeleton-reveal");
    // DOM audit: the reveal's panes have no role; every one of them is the root's child.
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
      await expect.poll(() => seen.length, { timeout: 2000 }).toBe(1);
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
      await expect.poll(() => seen.length, { timeout: 2000 }).toBe(1);
      expect(seen).toEqual([{ root: 400, content: 400, overflow: "", easing: false }]);
    }
  );

  it("reports once the height settles when the content grows to where the ease stands, ending it without a new one", async () => {
    let revealed: number[] = [];
    // The content grows through its own state, as an image loading in would: no new commit of the reveal.
    let grow: ((height: number) => void) | undefined;
    function Growing() {
      const [height, setHeight] = useState(250);
      useEffect(() => {
        grow = setHeight;
      }, []);
      return <div style={{ width: 288, height }}>Balance 1200 kr</div>;
    }
    const view = (loading: boolean) => (
      <SkeletonReveal
        loading={loading}
        label="Henter"
        reveal="together"
        onReveal={() => {
          revealed = [...revealed, slot("skeleton-reveal").getBoundingClientRect().height];
        }}>
        {loading ? <div style={{ width: 288, height: 100 }}>Balance</div> : <Growing />}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    rerender(view(false));
    const root = slot("skeleton-reveal");
    const ease = heightAnimation(root);
    if (ease === undefined) throw new Error("expected the root to ease toward its content");
    // Held partway, between 100 px and 250 px, while the fades finish and the old pane goes.
    ease.pause();
    ease.currentTime = 70;
    await wait(400);
    expect(revealed).toEqual([]);
    const standing = root.getBoundingClientRect().height;
    expect(standing).toBeGreaterThan(100);
    expect(standing).toBeLessThan(250);
    // The content changes to the very height the root shows: nothing is left to ease.
    grow?.(standing);
    await expect.poll(() => revealed.length, { timeout: 2000 }).toBe(1);
    expect(revealed).toEqual([standing]);
    expect(heightAnimation(root)).toBeUndefined();
    expect(root.style.overflow).toBe("");
  });

  it.each([
    ["", false],
    [" under a scaled ancestor", true],
  ] as const)("eases to a half-pixel content height once, and reports once%s", async (_name, scaled) => {
    let revealed = 0;
    const view = (data: { readonly height: number } | null) => {
      const reveal = (
        <SkeletonReveal
          data={data}
          sample={{ height: 100 }}
          label="Henter"
          reveal="together"
          onReveal={() => (revealed += 1)}>
          {(shown) => <div style={{ width: 288, height: shown.height }}>Balance 1200 kr</div>}
        </SkeletonReveal>
      );
      return scaled ? (
        <div style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>{reveal}</div>
      ) : (
        reveal
      );
    };
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    rerender(view({ height: 200.5 }));
    const root = slot("skeleton-reveal");
    const eases = new Set<Animation>();
    const start = performance.now();
    while (performance.now() - start < 500) {
      const ease = heightAnimation(root);
      if (ease !== undefined) eases.add(ease);
      await nextFrames(1);
    }
    expect(eases.size).toBe(1);
    expect(heightAnimation(root)).toBeUndefined();
    expect(root.style.overflow).toBe("");
    await expect.poll(() => revealed, { timeout: 2000 }).toBe(1);
  });
});
