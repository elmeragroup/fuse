/**
 * Unit under test: the page function's `inlineRow`, as `measuredFacts` reads the DOM in Chromium.
 * Oracle: CSS's own rules for the markup each case builds, which Chromium lays out.
 *
 * - A flex row blockifies its `display: inline` items (CSS Display 3 §2.7) and, where it neither
 *   wraps nor reverses, sets them on its one line in source order (CSS Flexbox 1 §9.3), so three
 *   one-word spans in a 300px row sit side by side.
 * - A wrapping 60px row breaks the three 40px spans onto lines of their own (§9.3), `row-reverse`
 *   sets them right to left (§5.1), and `order: -1` puts the last one first (§5.4), so none of these
 *   sets its items in source order on one line.
 * - A 30px item holding two six-letter words breaks them onto two lines, so its text leaves one line.
 * - A row 300px wide dense and 60px wide comfortable wraps in a mode the capture does not render.
 * - A row that is a block in the comfortable density lays its spans out inline there, in its line
 *   boxes (CSS 2.1 §9.4.2), and an item that is absolute there leaves the row's flow (CSS Flexbox 1
 *   §4.1), so neither keeps its items as the row's flex items in every mode.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MeasuredFacts } from "./capture-format.ts";
import { measuredFacts } from "./page-facts.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 200 } });
});

afterAll(async () => {
  await browser.close();
});

/** Measure the root `#root` of the markup: each element's facts, by its path from the root. */
async function factsOf(markup: string): Promise<ReadonlyMap<string, MeasuredFacts>> {
  await page.setContent(
    `<style>body{margin:0;font:16px/20px sans-serif} .item{display:inline;flex:none;width:40px} :root[data-density="comfortable"] .narrows{width:60px!important} :root[data-density="comfortable"] .blocks{display:block!important} :root[data-density="comfortable"] .lifts{position:absolute!important}</style><main data-compare-cell>${markup}</main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return facts;
}

/** The paths of the elements the page records a fact on, in order. */
async function pathsWith(fact: keyof MeasuredFacts, markup: string): Promise<readonly string[]> {
  return [...(await factsOf(markup))].flatMap(([path, facts]) => (facts[fact] === true ? [path] : []));
}

/** A row of three spans with the row's style and class, and the last span's style and text. */
function row(spec: {
  style?: string;
  className?: string;
  last?: string;
  lastClass?: string;
  lastText?: string;
}): string {
  const { style = "", className = "", last = "", lastClass = "", lastText = "c" } = spec;
  return `<div id="root" class="${className}" style="display:flex;width:300px;${style}"><span class="item">a</span><span class="item">b</span><span class="item ${lastClass}" style="${last}">${lastText}</span></div>`;
}

describe("a flex row's inline items the capture measures on one line", () => {
  it("records each item of a row that sets them side by side in source order", async () => {
    expect(await pathsWith("inlineRow", row({}))).toEqual(["0", "1", "2"]);
  });

  it.each([
    ["a wrapping row too narrow for them", row({ style: "flex-wrap:wrap;width:60px" })],
    ["a reversed row", row({ style: "flex-direction:row-reverse" })],
    ["a row whose last item `order` moves first", row({ last: "order:-1" })],
    [
      "a row whose last item breaks its two words onto two lines",
      row({ last: "width:30px", lastText: "cccccc cccccc" }),
    ],
    ["a row that wraps in the comfortable density", row({ style: "flex-wrap:wrap", className: "narrows" })],
    ["a row that is a block in the comfortable density", row({ className: "blocks" })],
    ["a row whose last item is absolute in the comfortable density", row({ lastClass: "lifts" })],
  ])("records nothing in %s", async (_, markup) => {
    expect(await pathsWith("inlineRow", markup)).toEqual([]);
  });
});

/**
 * Unit under test: the page function's `fitsAlongMain` beside `freeAlongMain`, which one sweep
 * measures from the same room. Oracle: Chromium's layout of a row holding a 100px item and a last
 * 40px item with `margin-left: auto`, 8px apart (CSS Flexbox 1 §8.1, §9.7): with the margin at zero
 * the items end at 148px. A 200px row leaves 52px past them, so they fit with 24px free; a 160px row
 * leaves 12px, so they fit with less than 24px free. A 100px row overflows them, and a row 200px wide
 * dense and 60px comfortable fits in one density and overflows in the other, so neither records
 * either fact. The row exactly as wide as its items and gap, 148px, leaves no whole pixel and
 * records neither.
 */
describe("a flex line the capture measures as fitting its items", () => {
  /** Which of the two facts the row of the given width records. */
  async function facts(width: string, className = "") {
    const measured = await factsOf(
      `<div id="root" class="${className}" style="display:flex;gap:8px;width:${width}"><div style="width:100px;flex:none"></div><div style="width:40px;flex:none;margin-left:auto"></div></div>`
    );
    const root = measured.get("");
    return { fits: root?.fitsAlongMain === true, free: root?.freeAlongMain === true };
  }

  it.each([
    ["200px", "", { fits: true, free: true }],
    ["160px", "", { fits: true, free: false }],
    ["100px", "", { fits: false, free: false }],
    ["148px", "", { fits: false, free: false }],
    ["200px", "narrows", { fits: false, free: false }],
  ])("in a %s row %s: %o", async (width, className, expected) => {
    expect(await facts(width, className)).toEqual(expected);
  });
});
