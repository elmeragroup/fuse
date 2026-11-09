/**
 * Unit under test: how SkeletonReveal moves its root's height through a pane swap, the
 * `RootHeight` owner in `skeleton-reveal-height.ts`. Oracles: the skeleton's and the content's own
 * heights, measured from their panes or written out from the fixtures' CSS, which the root's
 * height animation must run between, and the root's own declarations, which it must put back.
 */
import { useEffect, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, pollFrames, wait } from "../../../test/animation-frames";
import {
  LONG,
  SAMPLE,
  currentPane,
  heightAnimation,
  keyframeHeights,
  querySlot,
  renderInvoice,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";
import type { SkeletonRevealMode } from "./skeleton-reveal-plan";

failOnResizeObserverLoop();

describe("SkeletonReveal height", () => {
  /** A data reveal whose sample is 100 px and whose data is 200 px tall, with the root styled. */
  function renderSized(rootStyle: CSSProperties) {
    const view = (data: { readonly height: number } | null) => (
      <SkeletonReveal data={data} sample={{ height: 100 }} label="Henter" reveal="together" style={rootStyle}>
        {(shown) => <div style={{ width: 288, height: shown.height }}>Balance</div>}
      </SkeletonReveal>
    );
    const result = renderThemed(view(null));
    return { ...result, show: () => result.rerender(view({ height: 200 })) };
  }

  it("retargets to the root's natural height in its own box model, with no jump after the ease", async () => {
    // The content shrinks through its own state while the root eases toward it.
    let shrink: (() => void) | undefined;
    function Shrinking() {
      const [height, setHeight] = useState(300);
      useEffect(() => {
        shrink = () => setHeight(100);
      }, []);
      return <div style={{ width: 288, height }}>Balance</div>;
    }
    const view = (loading: boolean) => (
      <SkeletonReveal
        loading={loading}
        label="Henter"
        reveal="together"
        style={{ boxSizing: "content-box", minHeight: 150, padding: 20 }}>
        {loading ? <div style={{ width: 288, height: 100 }}>Balance</div> : <Shrinking />}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    rerender(view(false));
    expect(heightAnimation(root)).toBeDefined();
    await wait(80);
    shrink?.();
    // Content-box: the 150 px min-height holds the 100 px content, and the 20 px padding is added.
    const natural = 150 + 2 * 20;
    const ease = heightAnimation(root);
    if (ease === undefined) throw new Error("expected the ease to retarget");
    // The ease keeps the root's own box model: its last keyframe is the 150 px content height. The
    // retarget runs in the frame after the one the shrink lays out in, as the observer that sees
    // the shrink schedules it, so the keyframes are read once it has.
    const lastHeight = (): number => keyframeHeights(ease).at(-1) ?? Number.NaN;
    await pollFrames(() => Math.abs(lastHeight() - 150) < 0.05, true, 10);
    expect(lastHeight()).toBeCloseTo(150, 1);
    await ease.finished;
    for (let frame = 0; frame < 5; frame += 1) {
      await nextFrames(1);
      expect(root.offsetHeight).toBe(natural);
    }
  });

  /** How `easeOnce` lays out its reveal and what it does while the ease runs. */
  type EaseSetup = {
    /** The content for a height, in place of a 288 px wide block that tall. */
    readonly content?: (height: number) => ReactElement;
    /** Wraps the reveal, as a parent laying it out does. */
    readonly around?: (reveal: ReactElement) => ReactElement;
    /** Runs once, 80 ms into the reveal, while the ease runs. */
    readonly midway?: () => void;
  };

  /**
   * Runs a data reveal from a 100 px sample to `height` px of content with the root styled, and
   * returns every distinct height animation the root ran, its border-box height and box-sizing in
   * each frame of an ease with how far the ease had run, the last keyframe height it ran to, its
   * heights after, and `onReveal`'s count.
   */
  async function easeOnce(
    rootProps: { className?: string; style?: CSSProperties },
    height: number,
    setup: EaseSetup = {}
  ) {
    let revealed = 0;
    const content =
      setup.content ?? ((shown: number) => <div style={{ width: 288, height: shown }}>Balance</div>);
    const around = setup.around ?? ((reveal: ReactElement) => reveal);
    const view = (data: { readonly height: number } | null) =>
      around(
        <SkeletonReveal
          data={data}
          sample={{ height: 100 }}
          label="Henter"
          reveal="together"
          onReveal={() => (revealed += 1)}
          {...rootProps}>
          {(shown) => content(shown.height)}
        </SkeletonReveal>
      );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    rerender(view({ height }));
    const root = slot("skeleton-reveal");
    const eases = new Set<Animation>();
    const during: { height: number; progress: number; boxSizing: string }[] = [];
    let lastKeyframe = Number.NaN;
    let midway = setup.midway;
    const start = performance.now();
    while (performance.now() - start < 500) {
      if (midway !== undefined && performance.now() - start >= 80) {
        midway();
        midway = undefined;
      }
      const ease = heightAnimation(root);
      if (ease !== undefined) {
        eases.add(ease);
        lastKeyframe = keyframeHeights(ease).at(-1) ?? Number.NaN;
        during.push({
          height: root.getBoundingClientRect().height,
          progress: ease.effect?.getComputedTiming().progress ?? 0,
          boxSizing: getComputedStyle(root).boxSizing,
        });
      }
      await nextFrames(1);
    }
    const after: number[] = [];
    for (let frame = 0; frame < 5; frame += 1) {
      after.push(root.getBoundingClientRect().height);
      await nextFrames(1);
    }
    await expect.poll(() => revealed, { timeout: 2000 }).toBe(1);
    return { root, eases, during, lastKeyframe, after, revealed: () => revealed };
  }

  it("eases a flex root once, though its stretched pane resizes every frame", async () => {
    const { eases, after, revealed, root } = await easeOnce({ className: "flex" }, 200);
    expect(eases.size).toBe(1);
    expect(heightAnimation(root)).toBeUndefined();
    expect(after).toEqual([200, 200, 200, 200, 200]);
    expect(revealed()).toBe(1);
  });

  it("eases a content-box root inside its own max-height, with no jump once the ease ends", async () => {
    // Content-box: a 200 px max content height holds 300 px of content; 20 px padding each side.
    const natural = 200 + 2 * 20;
    const { during, after, root } = await easeOnce(
      { style: { boxSizing: "content-box", padding: 20, maxHeight: 200 } },
      300
    );
    expect(during.length).toBeGreaterThan(0);
    // The root keeps its box model while it eases, so its max-height bounds the ease as it bounds
    // the end: each frame stands where the ease's eased progress puts it between the 140 px
    // sample (100 px content and the padding) and the natural height, never clamped short of it.
    const sample = 100 + 2 * 20;
    expect(during.every((frame) => frame.boxSizing === "content-box")).toBe(true);
    for (const frame of during) {
      expect(frame.height).toBeCloseTo(sample + (natural - sample) * frame.progress, 0);
    }
    expect(after).toEqual([natural, natural, natural, natural, natural]);
    expect(getComputedStyle(root).boxSizing).toBe("content-box");
  });

  it("eases a vertical writing-mode root once, by its physical height", async () => {
    // Vertical-rl with a max-content height: the root's physical height is its content's, 100 px
    // for the sample and 200 px for the data.
    const { eases, during, after, revealed, root } = await easeOnce(
      { style: { writingMode: "vertical-rl", height: "max-content" } },
      200
    );
    expect(eases.size).toBe(1);
    expect(during.length).toBeGreaterThan(0);
    for (const frame of during) expect(frame.height).toBeCloseTo(100 + 100 * frame.progress, 0);
    expect(heightAnimation(root)).toBeUndefined();
    expect(after).toEqual([200, 200, 200, 200, 200]);
    expect(revealed()).toBe(1);
  });

  it("eases a scrolling root to its height with the floats it contains, keeping it a scroll container", async () => {
    // A scroll container is a block formatting context, so it contains its floats: the root
    // stands as tall as a float 40 px taller than the in-flow block beside it, which grows through
    // its own state from 150 px to 200 px while the ease runs. (A clip in its place would not; nor
    // would it keep a scrollbar gutter, which headless browsers draw zero pixels wide, so the
    // formatting context is what tells the two apart here.)
    let grow: (() => void) | undefined;
    function Growing() {
      const [height, setHeight] = useState(150);
      useEffect(() => {
        grow = () => setHeight(200);
      }, []);
      return (
        <div>
          <div style={{ float: "left", width: 50, height: height + 40 }} />
          <div style={{ height }}>Balance</div>
        </div>
      );
    }
    const overflows: string[] = [];
    const { during, lastKeyframe, after } = await easeOnce({ style: { overflowY: "scroll" } }, 150, {
      content: (shown) =>
        shown === 100 ? (
          <div>
            <div style={{ float: "left", width: 50, height: 100 }} />
            <div style={{ height: 60 }}>Balance</div>
          </div>
        ) : (
          <Growing />
        ),
      midway: () => {
        overflows.push(getComputedStyle(slot("skeleton-reveal")).overflowY);
        grow?.();
      },
    });
    const natural = 200 + 40;
    expect(during.length).toBeGreaterThan(0);
    expect(overflows).toEqual(["scroll"]);
    expect(lastKeyframe).toBe(natural);
    expect(after).toEqual([natural, natural, natural, natural, natural]);
  });

  it("eases an overflow-hidden root to its height with its content's margins inside it", async () => {
    // Overflow hidden contains its content's margins: 20 px above and below the content, which
    // grows through its own state from 150 px to 200 px while the ease runs.
    let grow: (() => void) | undefined;
    function Growing() {
      const [height, setHeight] = useState(150);
      useEffect(() => {
        grow = () => setHeight(200);
      }, []);
      return <p style={{ margin: "20px 0", width: 288, height }}>Balance</p>;
    }
    const { during, lastKeyframe, after } = await easeOnce({ style: { overflow: "hidden" } }, 150, {
      content: (shown) =>
        shown === 100 ? <p style={{ margin: "20px 0", width: 288, height: 60 }}>Balance</p> : <Growing />,
      midway: () => grow?.(),
    });
    const natural = 200 + 2 * 20;
    expect(during.length).toBeGreaterThan(0);
    expect(lastKeyframe).toBe(natural);
    expect(after).toEqual([natural, natural, natural, natural, natural]);
  });

  it("eases a shrinking flex item between its used heights, with no jump once the ease ends", async () => {
    // A 400 px column holds a 200 px sibling and the reveal, both `flex: 0 1 auto; min-height: 0`.
    // The 100 px sample fits; 400 px of data overflows the column by 200 px, which both shrink
    // away by their 200 and 400 px bases: the reveal gives up 2/3 of it, standing 800/3 px.
    const end = 800 / 3;
    const item: CSSProperties = { flex: "0 1 auto", minHeight: 0 };
    const { during, after, eases } = await easeOnce({ style: item }, 400, {
      around: (reveal) => (
        <div style={{ display: "flex", flexDirection: "column", height: 400 }}>
          <div style={{ ...item, height: 200 }} />
          {reveal}
        </div>
      ),
    });
    expect(eases.size).toBe(1);
    expect(during.length).toBeGreaterThan(0);
    for (const frame of during) {
      expect(frame.height).toBeGreaterThanOrEqual(100 - 0.5);
      expect(frame.height).toBeLessThanOrEqual(end + 0.5);
      expect(frame.height).toBeCloseTo(100 + (end - 100) * frame.progress, 0);
    }
    for (const height of after) expect(height).toBeCloseTo(end, 1);
  });

  it("keeps an explicitly sized root at its own height, with no ease", async () => {
    const { show } = renderSized({ height: 256 });
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    expect(root.offsetHeight).toBe(256);
    show();
    expect(heightAnimation(root)).toBeUndefined();
    for (let frame = 0; frame < 20; frame += 1) {
      expect(root.offsetHeight).toBe(256);
      await nextFrames(1);
    }
  });

  it.each([
    ["a min-height root", { minHeight: 150 }, 150],
    ["an auto root", {}, 100],
  ] as const)("eases %s from the height it really had", async (_name, rootStyle, before) => {
    const { show } = renderSized(rootStyle);
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    expect(root.offsetHeight).toBe(before);
    show();
    const ease = heightAnimation(root);
    if (ease === undefined) throw new Error("expected the root to ease");
    expect(keyframeHeights(ease)).toEqual([before, 200]);
  });

  it("eases the root's height from the skeleton's to the content's with overflow clipped, and restores its styles after", async () => {
    const { show } = renderInvoice(null);
    await document.fonts.ready;
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    const skeletonHeight = slot("skeleton-reveal-skeleton").getBoundingClientRect().height;

    show(LONG);
    const contentHeight = slot("skeleton-reveal-content").getBoundingClientRect().height;
    expect(contentHeight).toBeGreaterThan(skeletonHeight + 40);
    const ease = heightAnimation(root);
    if (ease === undefined) throw new Error("expected a height animation on the root");
    expect(keyframeHeights(ease)).toEqual([skeletonHeight, contentHeight]);
    expect(root.style.overflow).toBe("clip");

    ease.pause();
    ease.currentTime = 100;
    const midway = root.getBoundingClientRect().height;
    expect(midway).toBeGreaterThan(skeletonHeight);
    expect(midway).toBeLessThan(contentHeight);
    ease.play();

    await ease.finished;
    await nextFrames(1);
    expect(root.style.overflow).toBe("");
    expect(root.style.boxSizing).toBe("");
    expect(root.getBoundingClientRect().height).toBeCloseTo(contentHeight, 1);
    await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
  });

  it("continues an interrupted resize from the height it reached", async () => {
    const { show } = renderInvoice(null);
    await document.fonts.ready;
    await nextFrames(2);
    const root = slot("skeleton-reveal");

    show(LONG);
    const first = heightAnimation(root);
    if (first === undefined) throw new Error("expected a height animation on the root");
    first.pause();
    first.currentTime = 80;
    const reached = root.getBoundingClientRect().height;

    // A refetch over the data on screen: its skeleton is drawn from that data.
    show(LONG, true);
    const second = heightAnimation(root);
    if (second === undefined) throw new Error("expected the resize to continue");
    // The incoming skeleton is the current one; the first reveal's skeleton may still be fading out.
    const skeletonHeight = currentPane("skeleton-reveal-skeleton", root).getBoundingClientRect().height;
    const [from, to] = keyframeHeights(second);
    expect(from).toBeCloseTo(reached, 1);
    expect(to).toBeCloseTo(skeletonHeight, 1);
    expect(root.style.overflow).toBe("clip");
    await second.finished;
    await nextFrames(1);
    expect(root.style.overflow).toBe("");
  });

  it("retargets the height ease when the content changes size while it runs", async () => {
    function Notes({ invoice }: { invoice: Invoice }) {
      const [more, setMore] = useState(false);
      return (
        <div className="flex w-72 flex-col gap-2 rounded-lg border p-4">
          <h3 className="text-lg">{invoice.title}</h3>
          {(more ? invoice.lines : invoice.lines.slice(0, 2)).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <button type="button" onClick={() => setMore(true)}>
            More
          </button>
        </div>
      );
    }
    const view = (data: Invoice | null) => (
      <SkeletonReveal data={data} sample={SAMPLE} label="Henter" reveal="together">
        {(invoice) => <Notes invoice={invoice} />}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    rerender(view(LONG));
    const root = slot("skeleton-reveal");
    const content = slot("skeleton-reveal-content");
    const first = heightAnimation(root);
    expect(first).toBeDefined();
    const shortHeight = content.offsetHeight;

    roleNamed("button", "More").click();
    await nextFrames(2);
    const tallHeight = content.offsetHeight;
    expect(tallHeight).toBeGreaterThan(shortHeight + 40);
    const ease = heightAnimation(root);
    if (ease === undefined) throw new Error("expected the ease to keep running");
    const heights = keyframeHeights(ease);
    expect(heights[heights.length - 1]).toBeCloseTo(tallHeight, 0);
    await ease.finished;
    await nextFrames(1);
    expect(root.style.overflow).toBe("");
    expect(root.offsetHeight).toBe(tallHeight);
  });

  it("snaps the height when content lands at once over a running ease, and stops following the old pane", async () => {
    const tall = (
      <div className="w-72" style={{ height: 400 }}>
        Balance 1200 kr
      </div>
    );
    const short = (
      <div className="w-72" style={{ height: 100 }}>
        Balance
      </div>
    );
    const view = (loading: boolean, child: ReactElement, reveal: SkeletonRevealMode) => (
      <SkeletonReveal loading={loading} label="Henter" reveal={reveal}>
        {child}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(false, tall, "together"));
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    // 400 px of content gives way to a 100 px skeleton: the root eases down.
    rerender(view(true, short, "together"));
    const ease = heightAnimation(root);
    if (ease === undefined) throw new Error("expected the root to ease to the skeleton");
    // Held partway, so it is still running once the content has finished fading out.
    ease.pause();
    // DOM audit: the content pane has no role; it is gone once its fade out ends.
    await expect.poll(() => root.querySelectorAll('[data-slot="skeleton-reveal-content"]').length).toBe(0);
    // Someone typing as the taller content lands: smart brings it in at once.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    rerender(view(false, tall, "smart"));
    expect(heightAnimation(root)).toBeUndefined();
    expect(root.style.overflow).toBe("");
    const content = currentPane("skeleton-reveal-content", root);
    expect(root.offsetHeight).toBe(content.offsetHeight);
    await wait(320);
    expect(root.offsetHeight).toBe(content.offsetHeight);
  });

  it("pins the outgoing pane and eases the height in local pixels under a scaled ancestor", async () => {
    const { show } = renderInvoice(null, {
      around: (reveal) => (
        <div style={{ transform: "scale(0.5)", transformOrigin: "top left" }}>{reveal}</div>
      ),
    });
    await document.fonts.ready;
    await nextFrames(2);
    const skeleton = slot("skeleton-reveal-skeleton");
    // offset sizes are layout sizes, which the ancestor's transform does not scale.
    const width = skeleton.offsetWidth;
    const height = skeleton.offsetHeight;

    show(LONG);
    expect(Number.parseFloat(skeleton.style.width)).toBeCloseTo(width, 0);
    expect(Number.parseFloat(skeleton.style.height)).toBeCloseTo(height, 0);
    const ease = heightAnimation(slot("skeleton-reveal"));
    if (ease === undefined) throw new Error("expected a height animation on the root");
    const [from, to] = keyframeHeights(ease);
    expect(from).toBeCloseTo(height, 0);
    expect(to).toBeCloseTo(slot("skeleton-reveal-content").offsetHeight, 0);
  });

  it.each([
    {
      name: "overflow on a root that does not clip",
      // The root's own inline overflow, one longhand important: the ease clips both.
      declarations: [
        ["overflow-x", "visible", ""],
        ["overflow-y", "visible", "important"],
      ],
      around: (reveal: ReactElement) => reveal,
    },
    {
      name: "flex sizing on an item of a column",
      // The root's own inline flex sizing, one longhand important: the ease turns it off.
      declarations: [
        ["flex-grow", "1", ""],
        ["flex-shrink", "1", "important"],
        ["flex-basis", "10px", ""],
      ],
      around: (reveal: ReactElement) => (
        <div style={{ display: "flex", flexDirection: "column" }}>{reveal}</div>
      ),
    },
  ] as const)(
    "writes over the root's own inline $name while it eases, and restores them exactly",
    async ({ declarations, around }) => {
      const view = (loading: boolean, lines: number) =>
        around(
          <SkeletonReveal loading={loading} label="Henter" reveal="together">
            <div className="w-72">
              {Array.from({ length: lines }, (_, index) => (
                <p key={index}>Line {index + 1}</p>
              ))}
            </div>
          </SkeletonReveal>
        );
      const { rerender } = renderThemed(view(true, 1));
      await nextFrames(2);
      const root = slot("skeleton-reveal");
      for (const [name, value, priority] of declarations) root.style.setProperty(name, value, priority);
      const declared = (): string[] =>
        declarations.map(
          ([name]) => `${name}:${root.style.getPropertyValue(name)}:${root.style.getPropertyPriority(name)}`
        );
      const before = declarations.map(([name, value, priority]) => `${name}:${value}:${priority}`);
      expect(declared()).toEqual(before);

      rerender(view(false, 6));
      const ease = heightAnimation(root);
      if (ease === undefined) throw new Error("expected the root to ease to the taller content");
      const during = declared();
      during.forEach((declaration, index) => expect(declaration).not.toBe(before[index]));
      await ease.finished;
      await nextFrames(1);
      expect(declared()).toEqual(before);
    }
  );

  it("keeps each root element's own declarations when the render element changes during an ease", async () => {
    // Each element declares its own longhands of the ones an ease writes, and none of the other's.
    const eased = ["overflow-x", "overflow-y", "flex-grow", "flex-shrink", "flex-basis"];
    const declared = (element: HTMLElement): string[] =>
      eased.map(
        (name) => `${name}:${element.style.getPropertyValue(name)}:${element.style.getPropertyPriority(name)}`
      );
    const ownDiv = ["overflow-x:visible:", "overflow-y::", "flex-grow:1:", "flex-shrink::", "flex-basis::"];
    const ownSection = [
      "overflow-x::",
      "overflow-y:visible:",
      "flex-grow::",
      "flex-shrink:1:",
      "flex-basis:10px:",
    ];
    const view = (loading: boolean, element: "div" | "section", lines: number) => (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <SkeletonReveal
          loading={loading}
          label="Henter"
          reveal="together"
          render={
            element === "div" ? (
              <div style={{ overflowX: "visible", flexGrow: 1 }} />
            ) : (
              <section style={{ overflowY: "visible", flexShrink: 1, flexBasis: "10px" }} />
            )
          }>
          <div className="w-72">
            {Array.from({ length: lines }, (_, index) => (
              <p key={index}>Line {index + 1}</p>
            ))}
          </div>
        </SkeletonReveal>
      </div>
    );
    const { rerender } = renderThemed(view(true, "div", 1));
    await nextFrames(2);
    const div = slot("skeleton-reveal");
    expect(declared(div)).toEqual(ownDiv);
    // The content arrives: the div eases toward it, writing over its own declarations.
    rerender(view(false, "div", 6));
    expect(heightAnimation(div)).toBeDefined();
    expect(declared(div)).not.toEqual(ownDiv);
    await nextFrames(2);
    // Mid-ease, the reveal swaps back to its skeleton on a new root element.
    rerender(view(true, "section", 6));
    const section = slot("skeleton-reveal");
    expect(section.tagName).toBe("SECTION");
    await wait(600);
    expect(heightAnimation(section)).toBeUndefined();
    expect(declared(section)).toEqual(ownSection);
    expect(declared(div)).toEqual(ownDiv);
  });
});
