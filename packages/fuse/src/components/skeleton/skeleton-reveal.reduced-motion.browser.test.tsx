/**
 * Unit under test: SkeletonReveal under the reader's reduced-motion preference. Oracle: Fuse's
 * central rule, that layout motion is off while opacity fades stay. The root takes the content's
 * height at once, measured from the content pane itself, with no height animation and no clip, and
 * the content still arrives in place of the skeleton.
 */
import { describe, expect, it } from "vitest";

import "../../../dist/styles.css";
import "../../../dist/themes.css";
import { nextFrames } from "../../../test/animation-frames";
import { slot, failOnResizeObserverLoop } from "../../../test/skeleton-reveal-fixtures";
import { renderThemed } from "../../../test/themed-browser-render";
import { SkeletonReveal } from "./skeleton-reveal";

failOnResizeObserverLoop();

type Statement = { readonly lines: readonly string[] };

const SAMPLE: Statement = { lines: ["Balance 0 kr"] };
const DATA: Statement = {
  lines: ["Balance 1200 kr", "Paid 800 kr", "Due 400 kr", "Next 4 May", "Plan Fixed"],
};

describe("SkeletonReveal under reduced motion", () => {
  it("takes the content's height at once, with no height animation, and the content arrives", async () => {
    const view = (data: Statement | null) => (
      <SkeletonReveal data={data} sample={SAMPLE} reveal="sequence" label="Henter">
        {(statement) => (
          <div className="flex w-64 flex-col gap-2 rounded-lg border p-4">
            {statement.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}
      </SkeletonReveal>
    );
    const { rerender } = renderThemed(view(null));
    await nextFrames(2);
    const root = slot("skeleton-reveal");
    const skeletonHeight = root.getBoundingClientRect().height;

    rerender(view(DATA));
    const contentHeight = slot("skeleton-reveal-content").getBoundingClientRect().height;
    expect(contentHeight).toBeGreaterThan(skeletonHeight + 40);
    expect(root.getAnimations()).toEqual([]);
    expect(root.style.overflow).toBe("");
    expect(root.getBoundingClientRect().height).toBeCloseTo(contentHeight, 1);

    // DOM audit: the skeleton pane has no role; it is gone once the reveal settles.
    await expect.poll(() => document.querySelector('[data-slot="skeleton-reveal-skeleton"]')).toBeNull();
    expect(slot("skeleton-reveal-content").textContent).toBe(DATA.lines.join(""));
  });
});
