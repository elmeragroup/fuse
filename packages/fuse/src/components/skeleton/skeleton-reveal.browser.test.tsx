/**
 * Unit under test: SkeletonReveal's core behavior in the browser. Oracles: the accessibility
 * contract (a busy, labelled root; a skeleton hidden from assistive tech and inert; content
 * reachable only once it is on screen), the text each shape source renders, the hold the smart
 * mode documents, and the ghost's own text layout, which the bones must follow.
 */
import { useEffect, useLayoutEffect, useState } from "react";

import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import {
  InvoiceCard,
  LONG,
  SAMPLE,
  currentPane,
  heightAnimation,
  querySlot,
  renderInvoice,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
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

  it("draws the skeleton from the sample, from the data on screen when loading is forced, and from the last data shown on a reload", async () => {
    const { show } = renderInvoice(null);
    const ghostText = (): string => slot("skeleton-reveal-ghost").querySelector("h3")?.textContent ?? "";
    expect(ghostText()).toBe("Invoice 0000");

    show(LONG);
    expect(slot("skeleton-reveal-content").querySelector("h3")?.textContent).toBe("Invoice 4711");
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();

    show(LONG, true);
    expect(slot("skeleton-reveal").getAttribute("aria-busy")).toBe("true");
    expect(ghostText()).toBe("Invoice 4711");

    show(null);
    expect(ghostText()).toBe("Invoice 4711");
  });

  it("draws plain children while loading and shows them after", async () => {
    function Plain() {
      const [loading, setLoading] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setLoading(false)}>
            Done
          </button>
          <SkeletonReveal loading={loading} label="Henter" reveal="together">
            <p>Balance 1200 kr</p>
          </SkeletonReveal>
        </>
      );
    }
    renderThemed(<Plain />);
    expect(slot("skeleton-reveal-ghost").textContent).toBe("Balance 1200 kr");
    expect(querySlot("skeleton-reveal-content")).toBeNull();
    roleNamed("button", "Done").click();
    await expect.poll(() => querySlot("skeleton-reveal-content")?.textContent).toBe("Balance 1200 kr");
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });
});

describe("SkeletonReveal smart hold", () => {
  it("holds a client skeleton back under StrictMode exactly as without it", async () => {
    const opacity = (element: Element): number => Number.parseFloat(getComputedStyle(element).opacity);
    // Counts its effect setups, so the test knows StrictMode re-ran the effects it mounted.
    let setups = 0;
    function EffectProbe() {
      useLayoutEffect(() => {
        setups += 1;
      }, []);
      return null;
    }
    renderThemed(
      <>
        <EffectProbe />
        <SkeletonReveal data={null} sample={SAMPLE} label="Henter">
          {(invoice: Invoice) => <InvoiceCard invoice={invoice} />}
        </SkeletonReveal>
      </>,
      { strictMode: true }
    );
    expect(setups).toBe(2);
    const skeleton = slot("skeleton-reveal-skeleton");
    // StrictMode has already run the reveal's effects twice; the bones are still held.
    expect(opacity(skeleton)).toBe(0);
    await wait(100);
    expect(opacity(skeleton)).toBe(0);
    // Past the 150 ms hold and its 200 ms fade, the bones show.
    await expect.poll(() => opacity(skeleton), { timeout: 2000 }).toBe(1);
  });

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
    await wait(50);
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
    await expect.poll(() => getComputedStyle(skeleton).opacity, { timeout: 2000 }).toBe("1");
    rerender(<Slow data={LONG} />);
    expect(revealed).toBe(0);
    await expect.poll(() => revealed, { timeout: 2000 }).toBe(1);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });
});

describe("SkeletonReveal bones", () => {
  it.each([
    {
      name: "a percentage height in a flex root of a fixed height",
      root: { display: "flex", height: 256 },
      block: { width: 288, height: "100%" },
      // The flex item stretches to the root's 256 px, a definite height the block's 100% resolves to.
      expected: { height: 256 },
    },
    {
      name: "a percentage width in a column flex root of a fixed width",
      root: { display: "flex", flexDirection: "column", width: 400 },
      block: { width: "50%", height: 40 },
      // The flex item stretches to the root's 400 px, which the block's 50% resolves against.
      expected: { width: 200 },
    },
  ] as const)(
    "draws a block bone with $name as the content lays it out",
    async ({ root, block, expected }) => {
      const view = (loading: boolean) => (
        <SkeletonReveal loading={loading} label="Henter" reveal="together" style={root}>
          <div data-skeleton="block" data-chart="" style={block}>
            Chart
          </div>
        </SkeletonReveal>
      );
      const { rerender } = renderThemed(view(true));
      await nextFrames(2);
      const bone = slot("skeleton-reveal-bone").getBoundingClientRect();
      rerender(view(false));
      await nextFrames(2);
      const content = currentPane("skeleton-reveal-content", slot("skeleton-reveal"));
      // DOM audit: the chart block has no role; it is located by its own marker.
      const shown = content.querySelector<HTMLElement>("[data-chart]")?.getBoundingClientRect();
      if (shown === undefined) throw new Error("expected the content's block");
      for (const [axis, length] of Object.entries(expected)) {
        expect(axis === "height" ? shown.height : shown.width).toBe(length);
        expect(axis === "height" ? bone.height : bone.width).toBe(length);
      }
    }
  );

  it("rounds a tall bar with the medium corner of its own theme scope, not the document's", async () => {
    renderThemed(
      <div style={{ "--radius": "11px" }}>
        <SkeletonReveal loading label="Henter" reveal="together">
          <p className="text-5xl w-72">Balance</p>
        </SkeletonReveal>
        <div data-probe="rounded-md" className="rounded-md" />
      </div>
    );
    await nextFrames(2);
    // DOM audit: the reference has no role; the probe marks the element `rounded-md` rounds.
    const reference = document.querySelector('[data-probe="rounded-md"]');
    if (reference === null) throw new Error("expected the rounded-md reference");
    const corner = getComputedStyle(reference).borderTopLeftRadius;
    const outside = document.createElement("div");
    outside.className = "rounded-md";
    document.body.append(outside);
    const documentCorner = getComputedStyle(outside).borderTopLeftRadius;
    outside.remove();
    // The scope's corner must differ from the document's, or the test could not tell them apart.
    expect(corner).not.toBe(documentCorner);
    const bar = slot("skeleton-reveal-bone");
    // A 48 px line's bar is far taller than twice the corner, so the corner is not capped.
    expect(bar.getBoundingClientRect().height / 2).toBeGreaterThan(Number.parseFloat(corner));
    expect(getComputedStyle(bar).borderTopLeftRadius).toBe(corner);
  });

  it("draws a full-height block bone at the layer's fractional height", async () => {
    renderThemed(
      <SkeletonReveal loading label="Henter" reveal="together">
        <div data-skeleton="block" style={{ width: 288, height: 200.5 }} />
      </SkeletonReveal>
    );
    await nextFrames(2);
    const layer = slot("skeleton-reveal-bones");
    const bone = slot("skeleton-reveal-bone");
    expect(layer.getBoundingClientRect().height).toBe(200.5);
    expect(bone.getBoundingClientRect().height).toBe(layer.getBoundingClientRect().height);
  });

  it("redraws the bones when a part of the ghost changes its own text without changing size", async () => {
    // The test changes the part's own state, so only the part re-renders: no commit of the reveal.
    let rename: ((text: string) => void) | undefined;
    function Status() {
      const [text, setText] = useState("Due");
      useEffect(() => {
        rename = setText;
      }, []);
      return <span data-probe="status">{text}</span>;
    }
    renderThemed(
      <SkeletonReveal loading label="Henter" reveal="together">
        <div className="w-72">
          <Status />
        </div>
      </SkeletonReveal>
    );
    // DOM audit: the ghost's text has no role; the probe marks the node the bar stands for.
    const probe = document.querySelector('[data-probe="status"]');
    if (probe === null) throw new Error("expected the status probe");
    await nextFrames(2);
    if (rename === undefined) throw new Error("expected the status to mount");
    rename("Due 4 May 2026");
    await expect.poll(() => probe.textContent).toBe("Due 4 May 2026");
    await nextFrames(3);
    const range = document.createRange();
    range.selectNodeContents(probe);
    const line = range.getBoundingClientRect();
    const bars = [...document.querySelectorAll('[data-slot="skeleton-reveal-bone"]')].map((bone) =>
      bone.getBoundingClientRect()
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.left).toBeCloseTo(line.left, 0);
    expect(bars[0]?.width).toBeCloseTo(line.width, 0);
  });
});
