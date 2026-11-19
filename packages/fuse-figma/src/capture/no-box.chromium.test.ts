/**
 * Unit under test: the page function's `noBox`, `gridItems` and `gridItem`, through `measuredFacts`.
 * Oracle: Chromium's own box tree. An element that generates no box has no client rects (CSSOM View
 * §6), so a `display: contents` label around two 20px boxes in a two-column grid has none, and the
 * grid lays out the two boxes as its items, each in a column of its own (CSS Display 3 §2.5). A label
 * that also holds text adds an anonymous item (CSS Grid 1 §6.1), and so does one whose white space
 * alone `white-space: pre` preserves (CSS Text 4 §3.1), and one whose `::before` sits in
 * flow adds that box, so the grid lays out three items, while an absolute `::before` sits out of the
 * flow. A label that is `contents` in the mode the page starts in and a box in the comfortable density,
 * which the capture also renders, generates a box there.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

/** A two-column grid around a label of the given style and content, holding two 20px boxes. */
async function measure(label: string, inside = "", style = "") {
  await page.setContent(
    `<style>${style}</style><main data-compare-cell><div id="root" style="display:grid;grid-template-columns:auto auto;width:200px"><label id="label" style="${label}">${inside}<div style="width:20px;height:20px"></div><div style="width:20px;height:20px"></div></label></div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  const rects = await page.evaluate(() => document.querySelector("#label")?.getClientRects().length);
  return {
    rects,
    noBox: facts.get("0")?.noBox === true,
    items: facts.get("")?.gridItems,
    places: [facts.get("0/0")?.gridItem, facts.get("0/1")?.gridItem],
  };
}

describe("an element the capture measures as generating no box", () => {
  it("records a contents label around the grid's items, and each item's place", async () => {
    expect(await measure("display:contents")).toEqual({ rects: 0, noBox: true, items: 2, places: [0, 1] });
  });

  it("records one whose absolute ::before sits out of the flow", async () => {
    const before = "#label::before { content: ''; position: absolute; inset: 0 }";
    expect(await measure("display:contents", "", before)).toEqual({
      rects: 0,
      noBox: true,
      items: 2,
      places: [0, 1],
    });
  });

  it.each([
    ["holds text of its own", "display:contents", "Price", ""],
    ["sets a ::before in flow", "display:contents", "", "#label::before { content: '' }"],
    // Three spaces `white-space: pre` keeps lay out as an anonymous item of their own.
    ["holds white space it preserves", "display:contents;white-space:pre", "   ", ""],
  ])("records nothing, and no grid items, where the label %s", async (_case, label, inside, style) => {
    expect(await measure(label, inside, style)).toEqual({
      rects: 0,
      noBox: false,
      items: undefined,
      places: [undefined, undefined],
    });
  });

  it("records nothing where a mode the page does not start in makes the label a box", async () => {
    const comfortable = ':root[data-density="comfortable"] #label { display: block !important }';
    expect((await measure("display:contents", "", comfortable)).noBox).toBe(false);
  });
});
