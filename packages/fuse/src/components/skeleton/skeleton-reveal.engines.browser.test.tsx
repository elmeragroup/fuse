/**
 * Unit under test: SkeletonReveal's bones. Oracle: the revealed content's own layout, measured in
 * the test after the reveal: each visual line of text, read from a range over its text node, and
 * each block part's border box and corner radius. The sample equals the data, so the skeleton drawn
 * from it must stand exactly where the content lands, in every engine's text layout and font
 * metrics.
 */
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { slot, failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { Avatar } from "../avatar";
import { Button } from "../button/button";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

type Profile = { readonly name: string; readonly bio: string };

const PROFILE: Profile = {
  name: "Kari Nordmann",
  bio: "Customer since 2019, on a fixed price plan with monthly invoices and a smart meter",
};

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex w-64 flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <Avatar.Root>
          <Avatar.Fallback>KN</Avatar.Fallback>
        </Avatar.Root>
        <h3 className="text-lg">{profile.name}</h3>
      </div>
      <p className="text-sm">{profile.bio}</p>
      <Button>Edit</Button>
    </div>
  );
}

type Box = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

function relativeTo(rect: DOMRect, origin: DOMRect): Box {
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    right: rect.right - origin.left,
    bottom: rect.bottom - origin.top,
  };
}

/** The bones drawn while loading, each with its corner radius. */
function boneBoxes(origin: DOMRect): Array<Box & { readonly radius: string }> {
  return [...document.querySelectorAll<HTMLElement>('[data-slot="skeleton-reveal-bone"]')].map((bone) => ({
    ...relativeTo(bone.getBoundingClientRect(), origin),
    radius: getComputedStyle(bone).borderTopLeftRadius,
  }));
}

/** Every visual line of every text node under `root`, as the range over it reports. */
function textLines(root: Element, origin: DOMRect): Box[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const lines: Box[] = [];
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!(node instanceof Text) || node.data.trim() === "") continue;
    // DOM audit: a block part's own label is drawn by its block, not by a bar.
    if (node.parentElement?.closest('[data-slot="avatar"], [data-slot="button"]')) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) lines.push(relativeTo(rect, origin));
  }
  return lines;
}

describe("SkeletonReveal bones", () => {
  it("draw a bar over each line of the content's text and a block over each block part", async () => {
    const view = (data: Profile | null) => (
      <SkeletonReveal data={data} sample={PROFILE} reveal="together" label="Henter profil">
        {(profile) => <ProfileCard profile={profile} />}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await document.fonts.ready;
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    const bones = boneBoxes(root.getBoundingClientRect());

    rerender(view(PROFILE));
    // DOM audit: the skeleton pane has no role; it is gone once the reveal settles.
    await expect.poll(() => document.querySelector('[data-slot="skeleton-reveal-skeleton"]')).toBeNull();
    const origin = root.getBoundingClientRect();
    const content = slot("skeleton-reveal-content");

    const lines = textLines(content, origin);
    // The name on one line, and the bio wrapping onto several in the 256 px card.
    expect(lines.length).toBeGreaterThanOrEqual(3);
    for (const line of lines) {
      const bar = bones.find(
        (bone) =>
          Math.abs(bone.left - line.left) <= 1 &&
          Math.abs(bone.right - line.right) <= 1 &&
          bone.top >= line.top - 0.5 &&
          bone.bottom <= line.bottom + 0.5
      );
      expect(bar, `a bar over the line at ${String(line.top)}`).toBeDefined();
      // From ascender to descender: most of the line box, never a hairline.
      if (bar !== undefined) expect(bar.bottom - bar.top).toBeGreaterThan((line.bottom - line.top) / 2);
    }

    for (const part of [slot("avatar"), slot("button")].map((element) => ({
      element,
      box: relativeTo(element.getBoundingClientRect(), origin),
    }))) {
      const block = bones.find(
        (bone) =>
          Math.abs(bone.left - part.box.left) <= 0.5 &&
          Math.abs(bone.top - part.box.top) <= 0.5 &&
          Math.abs(bone.right - part.box.right) <= 0.5 &&
          Math.abs(bone.bottom - part.box.bottom) <= 0.5
      );
      // DOM audit: the slot names the part in a failure.
      expect(block, part.element.dataset.slot).toBeDefined();
      expect(block?.radius).toBe(getComputedStyle(part.element).borderTopLeftRadius);
    }

    // One bone per line and per block, and nothing else.
    expect(bones).toHaveLength(lines.length + 2);
  });

  it("draw bars from a web font's metrics once it loads, not the fallback's", async () => {
    // System sans faces under new names: one loads after the reveal measured its fallback, the
    // other before any reveal used it, so its bars come from its own metrics alone.
    const sources = 'local("Arial"), local("Helvetica"), local("Liberation Sans"), local("DejaVu Sans")';
    const late = new FontFace("RevealProbeLate", sources);
    const early = new FontFace("RevealProbeEarly", sources);
    await early.load();
    document.fonts.add(early);

    const reveal = (family: string) => (
      <SkeletonReveal loading label="Henter" reveal="together">
        <p className="text-4xl w-96" style={{ fontFamily: `${family}, monospace` }}>
          Planned maintenance
        </p>
      </SkeletonReveal>
    );
    const { unmount } = renderThemed(reveal("RevealProbeLate"));
    await nextFrames(2);
    await late.load();
    document.fonts.add(late);
    await document.fonts.ready;
    await nextFrames(4);
    const bar = (): DOMRect => {
      // DOM audit: the bones have no role.
      const bone = document.querySelector('[data-slot="skeleton-reveal-bone"]');
      if (bone === null) throw new Error("expected a bar");
      return bone.getBoundingClientRect();
    };
    const lateBar = bar();
    unmount();

    renderThemed(reveal("RevealProbeEarly"));
    await nextFrames(2);
    const earlyBar = bar();
    expect(lateBar.height).toBeCloseTo(earlyBar.height, 1);
    expect(lateBar.width).toBeCloseTo(earlyBar.width, 1);
  });
});
