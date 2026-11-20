/**
 * Unit under test: the browser behavior `widthHeldBy` in `flex-item-width.ts` assumes, which decides
 * whether a spaced row's label fills the room before its last layer in `label-layout.ts` and whether
 * a part fits the room beside it in `fitting-part.ts`.
 * Oracle: Chromium's layout of the Dropdown menu sub trigger's row, as `capture-flex-mapping.test.ts`
 * builds it: a 120px flex row with 8px padding and gap, its text an anonymous item before a 16px
 * `<svg>` with an auto start margin. The svg starts from its flex base size, its `flex-basis` where
 * that is a length and its `width` otherwise, clamped between its `min-width` and `max-width` (CSS
 * Flexbox 1 §9.2). A grow above 0 takes the room a short label leaves (§9.7). Where a long label
 * wraps, the row overflows and a shrink above 0 gives width back, down to the svg's automatic
 * minimum, the smaller of its width and its content's min-content width (§4.5). An empty svg has no
 * content, so it narrows below its 16px width there. A shrink of 0, or a `min-width` at least the
 * base size, keeps it at the base size. A `border-box` box is never narrower than its padding and
 * borders (CSS Box Sizing 3 §3). Each case measures one of these facts, and the expected widths
 * follow from them by hand.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 200 } });
});

afterAll(async () => {
  await browser.close();
});

/** A label that wraps in the row's 104px content box at 14px in any sans-serif face. */
const LONG_LABEL = "Share this document with everyone on the team";

/** A label that leaves the row room to spare. */
const SHORT_LABEL = "Share";

/**
 * The width Chromium lays out the row's last layer at, beside the given label.
 *
 * @param label - The row's text.
 * @param layer - The layer's markup, with the id `layer`.
 */
async function layerWidth(label: string, layer: string): Promise<number> {
  await page.setContent(
    `<div style="display:flex;width:120px;align-items:center;gap:8px;padding:0 8px;box-sizing:border-box;font:14px/20px sans-serif">${label}${layer}</div>`
  );
  return page.evaluate(() => document.querySelector("#layer")?.getBoundingClientRect().width ?? Number.NaN);
}

/**
 * The width of a 16px svg with an auto start margin after the given label.
 *
 * @param label - The row's text.
 * @param icon - Declarations the svg adds.
 */
function iconWidth(label: string, icon: string): Promise<number> {
  return layerWidth(label, `<svg id="layer" style="margin-left:auto;width:16px;height:16px;${icon}"></svg>`);
}

describe("a 16px svg after a row's text", () => {
  it("keeps its width beside a short label that fits", async () => {
    expect(await iconWidth(SHORT_LABEL, "")).toBe(16);
  });

  it("narrows below its width where a long label wraps", async () => {
    expect(await iconWidth(LONG_LABEL, "")).toBeLessThan(16);
  });

  it.each([
    ["a flex-shrink of 0", "flex-shrink:0", 16],
    ["a min-width of its width", "min-width:16px", 16],
    ["an 8px basis, which wins over its width", "flex-shrink:0;flex-basis:8px", 8],
    ["a 24px minimum, which raises its width", "min-width:24px", 24],
    ["an 8px maximum, which lowers its width", "flex-shrink:0;max-width:8px", 8],
  ])("is as wide as %s sets beside the long label", async (_case, icon, width) => {
    expect(await iconWidth(LONG_LABEL, icon)).toBe(width);
  });

  it("grows past its width beside a short label under a flex-grow of 1", async () => {
    expect(await iconWidth(SHORT_LABEL, "flex-grow:1;flex-shrink:0")).toBeGreaterThan(16);
  });
});

describe("a 24px border-box frame after a row's text", () => {
  it("is 32px wide under 16px padding on each side, which its border box cannot be narrower than", async () => {
    expect(
      await layerWidth(
        SHORT_LABEL,
        `<div id="layer" style="margin-left:auto;box-sizing:border-box;width:24px;height:24px;flex:none;padding:0 16px"></div>`
      )
    ).toBe(32);
  });
});
