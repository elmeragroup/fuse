/**
 * Unit under test: how SkeletonReveal moves its panes. Oracles: the leaving pane's place before
 * the swap, which it must keep; the opacity each pane and piece had reached, which no
 * interruption may raise; and the sequencing rules written out by hand from the pieces' own
 * boxes. The root's height is `skeleton-reveal-height.browser.test.tsx`'s.
 */
import { useEffect, useRef, useState } from "react";

import { describe, expect, it, onTestFinished } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { CaughtError, caughtError } from "../../../test/caught-error";
import {
  InvoiceCard,
  LONG,
  SAMPLE,
  currentPane,
  querySlot,
  scriptAnimations,
  slot,
  failOnResizeObserverLoop,
} from "../../../test/skeleton-reveal-fixtures";
import type { Invoice } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { TextField } from "../text-field/text-field";
import { SkeletonReveal } from "./skeleton-reveal";
import type { SkeletonRevealMode } from "./skeleton-reveal-plan";

failOnResizeObserverLoop();

describe("SkeletonReveal leaving panes", () => {
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

  it("lets go of the hold on a frozen piece its own component removed while its pane left", async () => {
    // The test removes a status through its own part's state, as a timer or an image load would.
    // Each part, in the content and in the ghost drawn from it, registers against its own span.
    const removers = new Map<Element, () => void>();
    function Status() {
      const [shown, setShown] = useState(true);
      const span = useRef<HTMLSpanElement | null>(null);
      useEffect(() => {
        const element = span.current;
        if (element !== null) removers.set(element, () => setShown(false));
      }, []);
      return shown ? (
        <span ref={span} data-probe="status">
          Syncing
        </span>
      ) : null;
    }
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="together">
        <div className="flex w-72 flex-col gap-2">
          <p>Balance 1200 kr</p>
          <Status />
        </div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    const holds: Animation[] = [];
    for (let round = 0; round < 3; round += 1) {
      rerender(view(false));
      await wait(50);
      // DOM audit: the status has no role; the probe marks the piece the test freezes.
      const status = currentPane("skeleton-reveal-content", slot("skeleton-reveal")).querySelector(
        '[data-probe="status"]'
      );
      if (status === null) throw new Error("expected the status piece");
      // Back to loading mid-fade: the status is frozen where its fade got to.
      rerender(view(true));
      holds.push(...scriptAnimations(status));
      removers.get(status)?.();
      await nextFrames(1);
      expect(status.isConnected).toBe(false);
      // DOM audit: the leaving content pane has no role; wait until it is gone.
      await expect
        .poll(() => document.querySelectorAll('[data-slot="skeleton-reveal-content"]').length)
        .toBe(0);
    }
    expect(holds.length).toBeGreaterThanOrEqual(3);
    expect(holds.map((hold) => hold.playState)).toEqual(holds.map(() => "idle"));
  });

  it("holds an interrupted piece with its own pulse at the opacity it had reached", async () => {
    const opacity = (element: Element): number => Number.parseFloat(getComputedStyle(element).opacity);
    // A pulse that states both ends, so nothing underneath it, inline style included, shows.
    const sheet = document.createElement("style");
    sheet.textContent = "@keyframes reveal-probe-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }";
    document.head.append(sheet);
    onTestFinished(() => sheet.remove());
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="together">
        <div className="flex w-72 flex-col gap-2">
          <p>Balance 1200 kr</p>
          <p style={{ animation: "reveal-probe-pulse 2s infinite" }} data-probe="pulsing">
            Syncing
          </p>
        </div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    rerender(view(false));
    await wait(50);
    // DOM audit: the pulsing label has no role; the probe marks it.
    const label = currentPane("skeleton-reveal-content", slot("skeleton-reveal")).querySelector(
      '[data-probe="pulsing"]'
    );
    if (label === null) throw new Error("expected the pulsing label");
    const reached = opacity(label);
    expect(reached).toBeLessThan(0.9);
    rerender(view(true));
    for (let frame = 0; frame < 10 && label.isConnected; frame += 1) {
      expect(opacity(label)).toBeLessThanOrEqual(reached + 0.05);
      await nextFrames(1);
    }
  });

  it("fades each bone out of a sequence from the opacity its pulse showed at the swap", async () => {
    type Row = { readonly title: string };
    const rows: readonly Row[] = ["4711", "4710", "4709", "4708"].map((id) => ({ title: `Invoice ${id}` }));
    const view = (data: readonly Row[] | null) => (
      <SkeletonReveal data={data} sample={rows} label="Henter" reveal="sequence">
        {(shown) => (
          <ul className="flex w-72 flex-col gap-2">
            {shown.map((row) => (
              <li key={row.title}>{row.title}</li>
            ))}
          </ul>
        )}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    // DOM audit: the bones have no role. Each bone's pulse is held halfway, at its dimmest.
    const bones = [...document.querySelectorAll<HTMLElement>('[data-slot="skeleton-reveal-bone"]')];
    expect(bones.length).toBeGreaterThan(0);
    for (const bone of bones) {
      for (const pulse of bone.getAnimations()) {
        pulse.pause();
        const period = Number(pulse.effect?.getTiming().duration);
        pulse.currentTime = period / 2;
      }
    }
    const opacity = (element: Element): number => Number.parseFloat(getComputedStyle(element).opacity);
    const atSwap = bones.map(opacity);
    expect(Math.max(...atSwap)).toBeLessThan(0.9);
    rerender(view(rows));
    for (let frame = 0; frame < 12; frame += 1) {
      bones.forEach((bone, index) => {
        if (bone.isConnected) expect(opacity(bone)).toBeLessThanOrEqual((atSwap[index] ?? 1) + 0.05);
      });
      await nextFrames(1);
    }
  });

  it.each([
    ["a flex row", "flex w-80"],
    ["a two-column grid", "grid w-80 grid-cols-2"],
  ])("pins the leaving pane where it stood before the swap in %s", async (_name, className) => {
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="together" className={className}>
        <div style={{ width: 96, height: 48 }}>Balance</div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    const skeleton = slot("skeleton-reveal-skeleton");
    // Where the skeleton stands in the root, in client pixels: nothing here is transformed.
    const place = () => {
      const origin = root.getBoundingClientRect();
      const rect = skeleton.getBoundingClientRect();
      return { left: rect.left - origin.left, top: rect.top - origin.top };
    };
    const before = place();

    rerender(view(false));
    expect(skeleton.hasAttribute("data-exiting")).toBe(true);
    for (let frame = 0; frame < 8 && skeleton.isConnected; frame += 1) {
      expect(place()).toEqual(before);
      await nextFrames(1);
    }
  });

  it("takes over from content still fading out even when it holds a loading SkeletonReveal of its own", async () => {
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Outer" reveal="together">
        <div className="w-72">
          <p>Account</p>
          <SkeletonReveal loading label="Inner">
            <p>Usage</p>
          </SkeletonReveal>
        </div>
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(false));
    await nextFrames(2);
    // DOM audit: the outer reveal is the first root in document order.
    const outer = slot("skeleton-reveal");
    const first = currentPane("skeleton-reveal-content", outer);
    rerender(view(true));
    await wait(50);
    rerender(view(false));
    // The content that was fading out hands over to the content replacing it, and is gone at once.
    expect(first.inert).toBe(true);
    expect(getComputedStyle(first).opacity).toBe("0");
  });

  it("leaves a skeleton interrupted mid-arrival from the opacity it reached, never brighter", async () => {
    const view = (data: Invoice | null) => (
      <SkeletonReveal data={data} sample={SAMPLE} label="Henter">
        {(invoice) => <InvoiceCard invoice={invoice} />}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    const skeleton = slot("skeleton-reveal-skeleton");
    const opacity = (element: Element): number => Number.parseFloat(getComputedStyle(element).opacity);
    // Past the 150 ms hold, partway into the skeleton's fade in.
    const start = performance.now();
    while (!(opacity(skeleton) > 0.05 && opacity(skeleton) < 0.7) && performance.now() - start < 2000) {
      await nextFrames(1);
    }
    const reached = opacity(skeleton);
    expect(reached).toBeGreaterThan(0.05);
    expect(reached).toBeLessThan(0.7);

    rerender(view(LONG));
    const layer = slot("skeleton-reveal-bones", skeleton);
    const shown: number[] = [];
    for (let frame = 0; frame < 12 && skeleton.isConnected; frame += 1) {
      shown.push(opacity(skeleton) * opacity(layer));
      await nextFrames(1);
    }
    expect(Math.max(...shown)).toBeLessThanOrEqual(reached + 0.05);
  });

  it("never brightens a piece of content interrupted mid-sequence", async () => {
    type Row = { readonly title: string };
    const rows: readonly Row[] = ["4711", "4710", "4709", "4708", "4707", "4706"].map((id) => ({
      title: `Invoice ${id}`,
    }));
    const view = (data: readonly Row[] | null, loading = false) => (
      <SkeletonReveal data={data} sample={rows} label="Henter" reveal="sequence" loading={loading}>
        {(shown) => (
          <ul className="flex w-72 flex-col gap-2">
            {shown.map((row) => (
              <li key={row.title}>{row.title}</li>
            ))}
          </ul>
        )}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    rerender(view(rows));
    await nextFrames(2);
    // DOM audit: the rows have no role of their own; each is one piece of the sequence.
    const items = [...currentPane("skeleton-reveal-content", slot("skeleton-reveal")).querySelectorAll("li")];
    const opacity = (element: Element): number => Number.parseFloat(getComputedStyle(element).opacity);
    const reached = items.map(opacity);
    // The later rows have not started yet.
    expect(Math.min(...reached)).toBeLessThan(0.5);
    const pane = currentPane("skeleton-reveal-content", slot("skeleton-reveal"));
    rerender(view(rows, true));
    for (let frame = 0; frame < 10 && pane.isConnected; frame += 1) {
      items.forEach((item, index) => {
        expect(opacity(item) * opacity(pane)).toBeLessThanOrEqual((reached[index] ?? 0) + 0.05);
      });
      await nextFrames(1);
    }
  });
});

describe("SkeletonReveal sequencing", () => {
  type Row = { readonly title: string; readonly note: string };
  const ROWS: readonly Row[] = [
    { title: "Invoice 4711", note: "Paid 4 May" },
    { title: "Invoice 4710", note: "Paid 4 April" },
    { title: "Invoice 4709", note: "Paid 4 March" },
    { title: "Invoice 4708", note: "Paid 4 February" },
  ];

  function renderRows(reveal: SkeletonRevealMode, sample: readonly Row[] = ROWS) {
    const view = (data: readonly Row[] | null) => (
      <SkeletonReveal data={data} sample={sample} label="Henter" reveal={reveal}>
        {(rows) => (
          <ul className="flex w-72 flex-col gap-2">
            {rows.map((row) => (
              <li key={row.title} className="flex flex-col">
                <span className="text-base">{row.title}</span>
                <span className="text-sm">{row.note}</span>
              </li>
            ))}
          </ul>
        )}
      </SkeletonReveal>
    );
    return { ...renderThemed(view(null)), show: (data: readonly Row[]) => view(data) };
  }

  /** The fade-in delay of each span, read off its Web Animation, with its box. */
  function pieceTimings(): Array<{ readonly delay: number; readonly box: DOMRect; readonly small: boolean }> {
    // DOM audit: the rows' spans have no role; their fades are what the test times.
    return [...slot("skeleton-reveal-content").querySelectorAll("span")].map((span) => {
      const effect = scriptAnimations(span)[0]?.effect;
      if (!(effect instanceof KeyframeEffect)) throw new Error(`expected a fade on ${span.textContent}`);
      return {
        delay: Number(effect.getTiming().delay),
        box: span.getBoundingClientRect(),
        small: span.classList.contains("text-sm"),
      };
    });
  }

  it("smart brings rows in top to bottom by their place on screen, smaller text 60 ms after its row", async () => {
    const { rerender, show } = renderRows("smart");
    // Past the 150 ms hold and up long enough that the reveal is not a flash.
    await wait(400);
    rerender(show(ROWS));
    const timings = pieceTimings();
    expect(timings).toHaveLength(8);
    const items = [...slot("skeleton-reveal-content").querySelectorAll("li")].map((item) =>
      item.getBoundingClientRect()
    );
    timings.forEach((timing, index) => {
      const row = items[Math.floor(index / 2)];
      if (row === undefined) throw new Error("expected a row");
      // Each row's place down the viewport spread over 320 ms; its smaller note 60 ms later.
      const expected = Math.min(Math.max(row.top / window.innerHeight, 0), 1) * 320 + (timing.small ? 60 : 0);
      expect(timing.delay).toBeCloseTo(expected, 0);
    });
    const titles = timings.filter((timing) => !timing.small).map((timing) => timing.delay);
    expect(titles).toEqual(titles.toSorted((a, b) => a - b));
    expect(new Set(titles).size).toBe(4);
  });

  it("sequence brings each piece in by its place in the reveal, down weighing 0.8 and across 0.2", async () => {
    // A two-row sample, so the root eases from the skeleton's height while the pieces are timed.
    const { rerender, show } = renderRows("sequence", ROWS.slice(0, 2));
    await nextFrames(2);
    rerender(show(ROWS));
    const reveal = slot("skeleton-reveal-content").getBoundingClientRect();
    const timings = pieceTimings();
    expect(timings).toHaveLength(8);
    for (const { delay, box } of timings) {
      const down = (box.top - reveal.top) / reveal.height;
      const across = (box.left - reveal.left) / reveal.width;
      expect(delay).toBeCloseTo(Math.min(Math.max(down * 0.8 + across * 0.2, 0), 1) * 320, 0);
    }
    // Every piece starts at the left edge, so the order is top to bottom.
    const delays = timings.map((timing) => timing.delay);
    expect(delays).toEqual(delays.toSorted((a, b) => a - b));
  });
});

describe("SkeletonReveal fades", () => {
  it("fades bare text content in with the together crossfade", async () => {
    type User = { readonly name: string };
    const view = (data: User | null) => (
      <SkeletonReveal data={data} sample={{ name: "Kari Nordmann" }} label="Henter" reveal="together">
        {(user) => user.name}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    rerender(view({ name: "Ola Hansen" }));
    const content = currentPane("skeleton-reveal-content", slot("skeleton-reveal"));
    expect(content.textContent).toBe("Ola Hansen");
    // Partway into the 200 ms crossfade, the text shows through a box that is still fading in.
    await wait(60);
    let shown = 1;
    for (let element: Element | null = content; element !== null; element = element.parentElement) {
      shown *= Number.parseFloat(getComputedStyle(element).opacity);
    }
    expect(shown).toBeLessThan(1);
  });

  it("goes back to loading mid-fade over content holding unrendered parts without throwing", async () => {
    const view = (loading: boolean) => (
      <CaughtError>
        <SkeletonReveal loading={loading} label="Henter" reveal="together">
          <form className="flex w-72 flex-col gap-2">
            <p>Balance 1200 kr</p>
            <input type="hidden" name="account" value="4711" />
            <p style={{ display: "none" }}>Hidden note</p>
          </form>
        </SkeletonReveal>
      </CaughtError>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    rerender(view(false));
    await wait(50);
    rerender(view(true));
    await nextFrames(2);
    expect(caughtError()).toEqual({ name: null, message: null });
    expect(slot("skeleton-reveal").getAttribute("aria-busy")).toBe("true");
    expect(currentPane("skeleton-reveal-skeleton", slot("skeleton-reveal"))).toBeInstanceOf(HTMLElement);
  });

  it.each(["together", "sequence"] as const)(
    "never fades a piece above its own opacity in a %s reveal: a pending field's hidden status icon, a disabled button",
    async (reveal) => {
      const opacity = (element: Element): number => Number.parseFloat(getComputedStyle(element).opacity);
      const parts = (
        <div className="flex w-72 flex-col gap-2">
          <TextField label="Email" isPending />
          <Button disabled>Save</Button>
        </div>
      );
      const view = (loading: boolean) => (
        <>
          {/* The oracle: the same parts outside any reveal, at their own opacity. */}
          <div data-probe="reference">{parts}</div>
          <SkeletonReveal loading={loading} label="Henter" reveal={reveal}>
            {parts}
          </SkeletonReveal>
        </>
      );
      const { rerender } = renderThemed(view(true));
      await nextFrames(2);
      // DOM audit: the reference parts and their icons have no role of their own to find them by.
      const reference = document.querySelector('[data-probe="reference"]');
      if (reference === null) throw new Error("expected the reference parts");
      const ownOpacities = [...reference.querySelectorAll("svg, button")].map(opacity);
      // The premise: one status icon is hidden, and the disabled button is half opaque.
      expect(ownOpacities).toContain(0);
      expect(ownOpacities).toContain(0.5);

      rerender(view(false));
      const content = currentPane("skeleton-reveal-content", slot("skeleton-reveal"));
      const parts_ = [...content.querySelectorAll("svg, button")];
      expect(parts_).toHaveLength(ownOpacities.length);
      // As the reveal starts, every part that shows at all is still fading in from below its own.
      parts_.forEach((part, index) => {
        const own = ownOpacities[index] ?? 1;
        if (own > 0) expect(opacity(part)).toBeLessThan(own);
      });
      for (let frame = 0; frame < 30; frame += 1) {
        parts_.forEach((part, index) => {
          expect(opacity(part)).toBeLessThanOrEqual((ownOpacities[index] ?? 1) + 0.01);
        });
        await nextFrames(1);
      }
      // Once the reveal has settled, each part shows its own opacity, neither more nor less.
      await expect.poll(() => querySlot("skeleton-reveal-skeleton")).toBeNull();
      await wait(400);
      expect(parts_.map(opacity)).toEqual(ownOpacities);
    }
  );
});
