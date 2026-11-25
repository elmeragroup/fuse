import { Activity, Suspense, createElement } from "react";
import type { ReactElement } from "react";

import interUrl from "@fontsource/inter/files/inter-latin-400-normal.woff2?url";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, pollFrames, useFakeFrames, useFakeIntervals } from "../../../test/animation-frames";
import { holdRequest } from "../../../test/request-hold";
import {
  InvoiceCard,
  LONG,
  SAMPLE,
  querySlot,
  renderInvoice,
  slot,
  failOnResizeObserverLoop,
  finishAnimations,
  currentPane,
  scriptAnimations,
  createSuspender,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
import { heightAnimation } from "../../../test/skeleton-reveal-fixtures";
import { effectiveOpacity, renderThemed, roleNamed, fkasPrivate } from "../../../test/themed-browser-render";
import { LocaleProvider } from "../../intl/locale-context";
import { ThemeScope } from "../../theme/theme-scope";
import { Button } from "../button/button";
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

    // The ghost renders the sample's real Button, which assistive tech cannot name and focus cannot
    // reach.
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

/**
 * Unit under test: how SkeletonReveal keeps content on its way out of its form, in every engine,
 * since what a control with no form owner does is each engine's own. Oracles: what the form
 * submits and whether it validates, read off `FormData` and `checkValidity`, and which button the
 * engine takes as the form's default, read off `:default`.
 */
describe("form", () => {
  describe("SkeletonReveal outgoing content in its form", () => {
    it("submits nothing, blocks nothing and gives the form no default button", async () => {
      // The skeleton drawn while loading holds no submit button, so the outgoing one is the only
      // submit button in the form once the refetch starts.
      const view = (loading: boolean, reference: string) => (
        <form aria-label="Payment">
          <SkeletonReveal loading={loading} label="Henter" reveal="smart">
            <div className="flex w-72 flex-col gap-2">
              <input name="reference" aria-label="Reference" defaultValue={reference} required />
              {loading ? null : <button type="submit">Pay</button>}
            </div>
          </SkeletonReveal>
        </form>
      );
      const { rerender } = renderThemed(view(false, ""));
      const form = roleNamed("form", "Payment");
      if (!(form instanceof HTMLFormElement)) throw new Error("expected a form");
      await nextFrames(2);
      // While it is the content on screen, the empty required input blocks the form, and its button
      // is the form's default.
      expect(new FormData(form).getAll("reference")).toEqual([""]);
      expect(form.checkValidity()).toBe(false);
      expect(roleNamed("button", "Pay").matches(":default")).toBe(true);

      // A refetch: under `smart` the content stays on screen through the skeleton's 150 ms hold.
      rerender(view(true, "4711"));
      const leaving = currentPane("skeleton-reveal-skeleton", slot("skeleton-reveal")).nextElementSibling;
      if (!(leaving instanceof HTMLElement)) throw new Error("expected the outgoing content pane");
      expect(leaving.hasAttribute("data-exiting")).toBe(true);
      // The outgoing pane is inert, so its button is out of the accessibility tree.
      const button = leaving.querySelector("button");
      if (button === null) throw new Error("expected the outgoing button");
      expect(new FormData(form).getAll("reference")).toEqual([]);
      expect(form.checkValidity()).toBe(true);
      expect(button.matches(":default")).toBe(false);
      expect(form.querySelector(":default")).toBeNull();
    });
  });
});

describe("lifecycle", () => {
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
      const panes = [
        ...root.querySelectorAll<HTMLElement>(":scope > [data-slot^='skeleton-reveal-']"),
      ].filter((pane) => pane.dataset.slot !== "skeleton-reveal-label");
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
          // `together` always fades, so waiting past the smart hold changes nothing here.
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
      "hides the ghost, fades the bones and calls onReveal only once the root has eased to taller content's height in a %s reveal",
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
            {(shown) => (
              // A card with a child, which the ghost keeps visible while it stands in.
              <div data-card="" style={{ width: 288, height: shown.height }}>
                <span>Balance 1200 kr</span>
              </div>
            )}
          </SkeletonReveal>
        );
        const { rerender } = renderThemed(view(null));
        await nextFrames(2);
        const skeleton = slot("skeleton-reveal-skeleton");
        const card = slot("skeleton-reveal-ghost", skeleton).querySelector("[data-card]");
        if (card === null) throw new Error("expected the ghost's card");
        const bone = slot("skeleton-reveal-bone", slot("skeleton-reveal-bones", skeleton));
        expect(getComputedStyle(card).visibility).toBe("visible");
        rerender(view({ height: 400 }));
        // At the swap the card goes at once, while the bones still show and fade out from there.
        expect(getComputedStyle(card).visibility).toBe("hidden");
        expect(effectiveOpacity(bone)).toBeGreaterThan(0);
        expect(heightAnimation(slot("skeleton-reveal"))).toBeDefined();
        // Run to its end, the exit leaves the bones at zero until the pane is removed.
        finishAnimations();
        expect(effectiveOpacity(bone)).toBe(0);
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
});

/**
 * Unit under test: which skeleton role a Fuse part keeps. Oracle: the part's own border box, which
 * a block bone covers whole and a text bar does not, so a part drawn as one block gives one bone
 * the size of the part.
 */
describe("parts", () => {
  it("draws a Button that takes its own data-slot as one block", async () => {
    renderThemed(
      <SkeletonReveal data={null} sample="Pay invoice" label="Henter">
        {(text) => <Button data-slot="pay-invoice">{text}</Button>}
      </SkeletonReveal>
    );
    const button = slot("pay-invoice", slot("skeleton-reveal-ghost"));
    await expect.poll(() => slot("skeleton-reveal-bones").children.length).toBe(1);
    const [bone] = slot("skeleton-reveal-bones").children;
    const box = (element: Element | undefined) => {
      const rect = element?.getBoundingClientRect();
      return rect && [rect.left, rect.top, rect.width, rect.height].map(Math.round);
    };
    expect(box(bone)).toEqual(box(button));
  });
});

/**
 * Unit under test: how a skeleton follows the document's fonts. Oracles: the ghost line's own text,
 * whose width the browser lays out in the face, which its one bone must match once the face
 * changes; the page's pending intervals and animation frames; and the timers of a frame's next
 * document. The line sits in a fixed-size box and does not wrap, so the face changes only the
 * text's width, which no resize or mutation of the ghost reports.
 */
describe("fonts", () => {
  const LINE_TEXT = "Faktura 4711";

  /** Renders a skeleton of one line in `family`, falling back to monospace. */
  function line(family: string): ReactElement {
    return (
      <SkeletonReveal data={null} sample={LINE_TEXT} label="Henter">
        {(text) => (
          <p
            style={{
              width: 320,
              height: 20,
              margin: 0,
              whiteSpace: "nowrap",
              font: `16px/20px "${family}", monospace`,
            }}>
            {text}
          </p>
        )}
      </SkeletonReveal>
    );
  }

  /** A face of Inter under `family`, at a URL of its own, removed from the document when the test finishes. */
  function interFace(family: string) {
    const url = new URL(interUrl, location.href);
    url.searchParams.set("family", family);
    const face = new FontFace(family, `url(${url.href})`);
    onTestFinished(() => {
      document.fonts.delete(face);
    });
    return { face, url: url.href };
  }

  /** The line's text width and its one bone's, in whole pixels. */
  function lineWidths() {
    const text = slot("skeleton-reveal-ghost").querySelector("p");
    if (text === null) throw new Error("expected the ghost's line");
    const range = document.createRange();
    range.selectNodeContents(text);
    const [bone, ...others] = slot("skeleton-reveal-bones").children;
    if (bone === undefined || others.length > 0) throw new Error("expected one bone");
    return {
      bone: Math.round(bone.getBoundingClientRect().width),
      text: Math.round(range.getBoundingClientRect().width),
    };
  }

  /** Settles at the first ResizeObserver delivery for `element`, when the browser first measures it. */
  function firstResize(element: Element): Promise<void> {
    return new Promise((resolve) => {
      const observer = new ResizeObserver(() => {
        observer.disconnect();
        resolve();
      });
      observer.observe(element);
    });
  }

  /** Settles when the bones have drawn the line's first measure, in whatever face it has then. */
  async function firstDraw(): Promise<void> {
    await firstResize(slot("skeleton-reveal-skeleton"));
    // The pane's observer, created before this one, requested the measure's frame first.
    await nextFrames(1);
  }

  it("redraws the bones when a face of the line's family loads while another request keeps the set loading", async () => {
    useFakeIntervals();
    await document.fonts.ready;
    const other = interFace("Fuse Font Watch Other");
    const title = interFace("Fuse Font Watch Load");
    await holdRequest(other.url);
    const releaseTitle = await holdRequest(title.url);
    const loading = new Promise((resolve) =>
      document.fonts.addEventListener("loading", resolve, { once: true })
    );
    document.fonts.add(other.face);
    document.fonts.add(title.face);
    void other.face.load();
    void title.face.load();
    renderThemed(line("Fuse Font Watch Load"));
    await firstDraw();
    await loading;
    const fallback = lineWidths();
    expect(title.face.status).toBe("loading");
    expect(fallback.bone).toBe(fallback.text);

    await releaseTitle();
    await title.face.loaded;
    const loaded = lineWidths().text;
    expect(loaded).not.toBe(fallback.text);
    // The other request keeps the set loading, so it fires no event, and the interval never runs.
    expect(other.face.status).toBe("loading");
    await pollFrames(() => lineWidths().bone, loaded);
  });

  it("redraws the bones at the timer's next check when a face that already loaded is added, and stops the timer at unmount", async () => {
    useFakeIntervals();
    const added = interFace("Fuse Font Watch Add");
    await added.face.load();
    const { unmount } = renderThemed(line("Fuse Font Watch Add"));
    await firstDraw();
    const fallback = lineWidths();
    document.fonts.add(added.face);
    const loaded = lineWidths().text;
    expect(loaded).not.toBe(fallback.text);
    // No event reports the add, so the measures already due keep the fallback width.
    await nextFrames(3);
    expect(lineWidths().bone).toBe(fallback.bone);

    vi.advanceTimersToNextTimer();
    await pollFrames(() => lineWidths().bone, loaded);
    unmount();
    expect(vi.getTimerCount(), "intervals pending").toBe(0);
  });

  it("requests no animation frame while a measured skeleton waits with nothing changing", async () => {
    // Faked from before the mount, so every frame the skeleton asks for runs only when stepped.
    useFakeFrames();
    renderThemed(line("Fuse Font Watch Idle"));
    await firstResize(slot("skeleton-reveal-skeleton"));
    await document.fonts.ready;
    // A stalled request: the skeleton stays up, and only the compositor's pulse moves.
    for (let frame = 0; frame < 5; frame += 1) vi.advanceTimersToNextFrame();
    expect(vi.getTimerCount(), "animation frames pending").toBe(0);
  });

  it("leaves the timers of a frame's next document running when a skeleton the frame showed before unmounts", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    onTestFinished(() => {
      frame.remove();
    });
    const navigate = async (srcdoc: string): Promise<Window> => {
      const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
      frame.srcdoc = srcdoc;
      await loaded;
      if (frame.contentWindow === null) throw new Error("expected the frame's window");
      return frame.contentWindow;
    };
    const first = await navigate('<!doctype html><body data-page="first"></body>');
    const setInterval = vi.spyOn(first, "setInterval");
    // The outgoing document turns hidden as the frame navigates, which would stop the interval
    // while the frame still shows it. Stopped here, the interval is still pending at the unmount.
    first.addEventListener("visibilitychange", (event) => event.stopPropagation(), { capture: true });
    const root = createRoot(first.document.body.appendChild(first.document.createElement("div")));
    // A synchronous render runs its passive effects before it returns, the pane's watch among them.
    flushSync(() => {
      root.render(line("Fuse Font Watch Frame"));
    });
    expect(setInterval, "the watch's intervals").toHaveBeenCalledOnce();

    const next = await navigate('<!doctype html><body data-page="next"></body>');
    // Each document numbers its timers from the start, so the next document's first timeout takes
    // the interval's id. Timeouts with one delay run in the order they were set, so the second runs
    // after it, and settles the promise first only when the unmount cleared the first.
    const { promise: ran, resolve } = Promise.withResolvers<boolean>();
    const reused = next.setTimeout(() => resolve(true), 0);
    next.setTimeout(() => resolve(false), 0);
    expect(setInterval, "the interval whose id the next document reuses").toHaveReturnedWith(reused);
    root.unmount();
    expect(await ran).toBe(true);
  });
});

/**
 * Unit under test: SkeletonReveal's server HTML, what a reader gets before hydration. Oracle: the
 * accessibility and form contract, read off the parsed markup rather than its spelling: a busy
 * root with its label, a skeleton hidden from assistive tech and inert, ghost controls in a
 * disabled fieldset, no bones measured yet, and content only once there is data. Presentation is
 * the browser tests'.
 */
describe("server HTML", () => {
  type ServerInvoice = { readonly number: string };

  /**
   * Server-renders a tree inside the theme scope every suite shares, as a host's page would emit
   * it, and parses the HTML into a document without running or hydrating anything in it.
   */
  function serverDocument(tree: ReactElement): Document {
    const markup = renderToStaticMarkup(createElement(ThemeScope, { theme: fkasPrivate }, tree));
    return new DOMParser().parseFromString(`<body>${markup}</body>`, "text/html");
  }

  function invoiceDocument(data: ServerInvoice | null): Document {
    return serverDocument(
      createElement(SkeletonReveal<ServerInvoice>, {
        data,
        sample: { number: "Invoice 0000" },
        label: "Henter faktura",
        children: (invoice: ServerInvoice) =>
          createElement(
            "label",
            null,
            invoice.number,
            createElement("input", { name: "invoice", required: true })
          ),
      })
    );
  }

  it("is busy and labelled, with an inert skeleton hidden from assistive tech and no bones yet", () => {
    const document = invoiceDocument(null);
    expect(querySlot("skeleton-reveal", document)?.getAttribute("aria-busy")).toBe("true");
    expect(querySlot("skeleton-reveal-label", document)?.textContent).toBe("Henter faktura");
    const skeleton = querySlot("skeleton-reveal-skeleton", document);
    expect(skeleton?.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton?.hasAttribute("inert")).toBe(true);
    // Not measured: the stylesheet's first-paint fallback applies until the client draws bones.
    expect(skeleton?.hasAttribute("data-measured")).toBe(false);
    expect(querySlot("skeleton-reveal-bones", document)?.children).toHaveLength(0);
    expect(querySlot("skeleton-reveal-ghost", document)?.textContent).toBe("Invoice 0000");
    expect(querySlot("skeleton-reveal-content", document)).toBeNull();
  });

  it("defaults the label to the locale dictionary", () => {
    const label = (locale: "nb-NO" | "en-US"): string | null | undefined =>
      querySlot(
        "skeleton-reveal-label",
        serverDocument(
          createElement(LocaleProvider, {
            locale,
            children: createElement(SkeletonReveal, {
              loading: true,
              children: createElement("p", null, "Sum"),
            }),
          })
        )
      )?.textContent;
    expect([label("nb-NO"), label("en-US")]).toEqual(["Laster", "Loading"]);
  });

  it("keeps the ghost's controls out of their form from the first paint", () => {
    const document = invoiceDocument(null);
    const input = querySlot("skeleton-reveal-ghost", document)?.querySelector("input");
    expect(input?.closest("fieldset")?.disabled).toBe(true);
    expect(input?.matches(":disabled")).toBe(true);
  });

  it("renders data as enabled content, not busy, with no label or skeleton", () => {
    const document = invoiceDocument({ number: "Invoice 4711" });
    expect(querySlot("skeleton-reveal", document)?.getAttribute("aria-busy")).toBe("false");
    const content = querySlot("skeleton-reveal-content", document);
    expect(content?.textContent).toBe("Invoice 4711");
    expect(content?.querySelector("input")?.matches(":disabled")).toBe(false);
    expect(querySlot("skeleton-reveal-label", document)).toBeNull();
    expect(querySlot("skeleton-reveal-skeleton", document)).toBeNull();
  });
});
