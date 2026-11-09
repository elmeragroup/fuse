/**
 * Unit under test: the reveal's ResizeObservers under a slow page. A callback that changes the
 * layout it observes leaves notifications undelivered, and the browser reports that as a window
 * `error` event, "ResizeObserver loop completed with undelivered notifications", which a
 * consumer's error monitoring logs. Oracle: the page's own error events, with Chromium's CPU
 * throttled through CDP so frames run long, as on a loaded machine; none may name the loop.
 */
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cdp } from "vitest/browser";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames, wait } from "../../../test/animation-frames";
import { failOnResizeObserverLoop, slot } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

type ThrottleCdp = {
  readonly send: (
    method: "Emulation.setCPUThrottlingRate",
    params: { readonly rate: number }
  ) => Promise<void>;
};

failOnResizeObserverLoop();

describe("SkeletonReveal observers on a slow page", () => {
  // SAFETY: vitest types CDPSession as {}; Playwright's Chromium session implements send.
  const session = (): ThrottleCdp => cdp() as ThrottleCdp;
  beforeAll(async () => {
    await session().send("Emulation.setCPUThrottlingRate", { rate: 8 });
  });
  afterAll(async () => {
    await session().send("Emulation.setCPUThrottlingRate", { rate: 1 });
  });

  /**
   * Watches the root for the clip a height ease writes on it while it runs, which a throttled page
   * may start and end between two frames: the style attribute's old values keep it.
   *
   * @returns Whether an ease has run since, read after waiting through at least `ms` of frames.
   */
  function watchEase(): (ms: number) => Promise<boolean> {
    const root = slot("skeleton-reveal");
    let eased = false;
    const observer = new MutationObserver((records) => {
      eased ||= records.some((record) => record.oldValue?.includes("clip") ?? false);
    });
    observer.observe(root, { attributes: true, attributeFilter: ["style"], attributeOldValue: true });
    return async (ms) => {
      await wait(ms);
      observer.disconnect();
      return eased || (root.getAttribute("style") ?? "").includes("clip");
    };
  }

  /** A data reveal from a 100 px sample to `height` px, with the root styled, run to its end. */
  async function reveal(style: CSSProperties | undefined, className: string | undefined, height: number) {
    const view = (data: { readonly height: number } | null) => (
      <SkeletonReveal
        data={data}
        sample={{ height: 100 }}
        label="Henter"
        reveal="together"
        className={className}
        style={style}>
        {(shown) => <div style={{ width: 288, height: shown.height }}>Balance</div>}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    const eased = watchEase();
    rerender(view({ height }));
    expect(await eased(600)).toBe(true);
  }

  it("eases a flex root, whose stretched pane resizes every frame", async () => {
    await reveal(undefined, "flex", 200);
  });

  it("eases a vertical writing-mode root", async () => {
    await reveal({ writingMode: "vertical-rl", height: "max-content" }, undefined, 200);
  });

  it("retargets an ease when the content grows while it runs", async () => {
    let grow: (() => void) | undefined;
    function Growing() {
      const [height, setHeight] = useState(150);
      useEffect(() => {
        grow = () => setHeight(250);
      }, []);
      return <div style={{ width: 288, height }}>Balance</div>;
    }
    const view = (loading: boolean) => (
      <SkeletonReveal loading={loading} label="Henter" reveal="together">
        {loading ? <div style={{ width: 288, height: 100 }}>Balance</div> : <Growing />}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(true));
    await nextFrames(2);
    const eased = watchEase();
    rerender(view(false));
    await nextFrames(1);
    grow?.();
    expect(await eased(600)).toBe(true);
  });

  it("re-measures the bones as the ghost resizes", async () => {
    let widen: (() => void) | undefined;
    function Resizing() {
      const [width, setWidth] = useState(200);
      useEffect(() => {
        widen = () => setWidth(320);
      }, []);
      return (
        <div style={{ width }}>
          <p>Planned maintenance tonight on the grid in your area, from ten until midnight.</p>
        </div>
      );
    }
    renderThemed(
      <SkeletonReveal loading label="Henter" reveal="together">
        <Resizing />
      </SkeletonReveal>
    );
    await nextFrames(2);
    widen?.();
    await wait(300);
  });
});
