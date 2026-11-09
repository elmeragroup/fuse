/**
 * Unit under test: SkeletonReveal rendered into a same-origin iframe through a portal, as Fuse's
 * Frame does, where the frame's nodes belong to another realm than the code measuring them.
 * Oracle: the frame's own text layout, read with ranges over the revealed content's text nodes,
 * which the bones drawn from the same data must cover, and the content that must replace them.
 */
import { createPortal } from "react-dom";
import { describe, expect, it, onTestFinished } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

type Notice = { readonly title: string; readonly body: string };

const NOTICE: Notice = { title: "Planned maintenance", body: "Power may be off for up to two hours" };

/** A same-origin frame whose document carries this page's stylesheets, as a Frame host's does. */
function styledFrame(): Document {
  const frame = document.createElement("iframe");
  frame.style.width = "480px";
  frame.style.height = "320px";
  document.body.append(frame);
  onTestFinished(() => frame.remove());
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) throw new Error("expected a same-origin frame document");
  // DOM audit: the page's stylesheets have no role; the frame takes a copy of each.
  for (const sheet of document.querySelectorAll("style, link[rel='stylesheet']")) {
    frameDocument.head.append(sheet.cloneNode(true));
  }
  return frameDocument;
}

describe("SkeletonReveal in a same-origin frame", () => {
  it("measures bones over the frame's text lines and reveals the content", async () => {
    const frameDocument = styledFrame();
    const view = (data: Notice | null) =>
      createPortal(
        <SkeletonReveal data={data} sample={NOTICE} label="Henter" reveal="together">
          {(notice) => (
            <div className="flex w-72 flex-col gap-2 p-4">
              <h3 className="text-lg">{notice.title}</h3>
              <p>{notice.body}</p>
            </div>
          )}
        </SkeletonReveal>,
        frameDocument.body
      );
    const { rerender } = renderThemed(view(null));
    await nextFrames(3);
    // DOM audit: the reveal's parts in the frame have no role; locate them by data-slot.
    const root = frameDocument.querySelector('[data-slot="skeleton-reveal"]');
    if (root === null) throw new Error("expected the reveal in the frame");
    const origin = root.getBoundingClientRect();
    const bones = [...frameDocument.querySelectorAll('[data-slot="skeleton-reveal-bone"]')].map((bone) => {
      const rect = bone.getBoundingClientRect();
      return {
        left: rect.left - origin.left,
        right: rect.right - origin.left,
        top: rect.top - origin.top,
        bottom: rect.bottom - origin.top,
      };
    });

    rerender(view(NOTICE));
    await expect.poll(() => frameDocument.querySelector('[data-slot="skeleton-reveal-skeleton"]')).toBeNull();
    const content = frameDocument.querySelector('[data-slot="skeleton-reveal-content"]');
    expect(content?.textContent).toBe(`${NOTICE.title}${NOTICE.body}`);

    // Each line of the revealed text, from a range in the frame's own document.
    const lines: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const walker = frameDocument.createTreeWalker(content ?? frameDocument.body, NodeFilter.SHOW_TEXT);
    const range = frameDocument.createRange();
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        lines.push({
          left: rect.left - origin.left,
          right: rect.right - origin.left,
          top: rect.top - origin.top,
          bottom: rect.bottom - origin.top,
        });
      }
    }
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(bones).toHaveLength(lines.length);
    for (const line of lines) {
      const bar = bones.find(
        (bone) =>
          Math.abs(bone.left - line.left) <= 1 &&
          Math.abs(bone.right - line.right) <= 1 &&
          bone.top >= line.top - 0.5 &&
          bone.bottom <= line.bottom + 0.5
      );
      expect(bar, `a bar over the line at ${String(line.top)}`).toBeDefined();
    }
  });
});
