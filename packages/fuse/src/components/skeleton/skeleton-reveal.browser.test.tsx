import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import {
  InvoiceCard,
  LONG,
  SAMPLE,
  querySlot,
  renderInvoice,
  slot,
  failOnResizeObserverLoop,
  finishAnimations,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
import { heightAnimation } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

describe("SkeletonReveal", () => {
  it("is busy and labelled while loading, keeps the skeleton from assistive tech and the keyboard, and reaches the content only once it is shown", async () => {
    const { show } = renderInvoice(null);
    const root = slot("skeleton-reveal");
    expect(root.getAttribute("aria-busy")).toBe("true");
    expect(slot("skeleton-reveal-label").textContent).toBe("Henter faktura");
    const skeleton = slot("skeleton-reveal-skeleton");
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.inert).toBe(true);

    // The ghost renders the sample's real Button, which is neither named to assistive tech nor focusable.
    expect(page.getByRole("button").query()).toBeNull();
    const ghostButton = skeleton.querySelector("button");
    expect(ghostButton).toBeInstanceOf(HTMLButtonElement);
    ghostButton?.focus();
    expect(document.activeElement).not.toBe(ghostButton);

    show(LONG);
    expect(root.getAttribute("aria-busy")).toBe("false");
    expect(querySlot("skeleton-reveal-label")).toBeNull();
    const pay = roleNamed("button", "Pay Invoice 4711");
    pay.focus();
    expect(document.activeElement).toBe(pay);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });
});

describe("SkeletonReveal smart hold", () => {
  it("shows a held skeleton once the hold passes, and calls onReveal once the content is in", async () => {
    let revealed = 0;
    function Slow({ data }: { data: Invoice | null }) {
      return (
        <SkeletonReveal data={data} sample={SAMPLE} label="Henter" onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      );
    }
    const { rerender } = renderThemed(<Slow data={null} />);
    const skeleton = slot("skeleton-reveal-skeleton");
    expect(getComputedStyle(skeleton).opacity).toBe("0");
    // The hold and the fade are Web Animations; finished, the clock plays no part.
    finishAnimations();
    await expect.poll(() => getComputedStyle(skeleton).opacity).toBe("1");
    rerender(<Slow data={LONG} />);
    expect(revealed).toBe(0);
    await nextFrames(2);
    finishAnimations();
    await expect.poll(() => revealed).toBe(1);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });
});

describe("SkeletonReveal smart hold", () => {
  it("holds a client skeleton back under smart, and lands content at once when it beats the hold", async () => {
    let revealed = 0;
    function Fast({ data }: { data: Invoice | null }) {
      return (
        <SkeletonReveal data={data} sample={SAMPLE} label="Henter" onReveal={() => (revealed += 1)}>
          {(invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      );
    }
    const { rerender } = renderThemed(<Fast data={null} />);
    const skeleton = slot("skeleton-reveal-skeleton");
    // The space is reserved, but nothing shows yet.
    expect(skeleton.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(getComputedStyle(skeleton).opacity).toBe("0");
    // Paused, the hold cannot run out before the data lands, however slowly the runner renders.
    for (const animation of skeleton.getAnimations()) animation.pause();
    await nextFrames(2);
    expect(getComputedStyle(skeleton).opacity).toBe("0");

    rerender(<Fast data={LONG} />);
    const root = slot("skeleton-reveal");
    expect(heightAnimation(root)).toBeUndefined();
    const content = slot("skeleton-reveal-content");
    expect(content.getAnimations({ subtree: true })).toEqual([]);
    expect(getComputedStyle(skeleton).opacity).toBe("0");
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
    expect(revealed).toBe(1);
  });
});
