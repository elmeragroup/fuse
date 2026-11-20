/**
 * Unit under test: the page function's `basisAsDeclared`, as `measuredFacts` reads the DOM in
 * Chromium. Oracle: Chromium's layout of a root whose height is `calc(100% - 1px)` in a 36px list,
 * the list an item of a flex column (CSS Flexbox 1 §9.7, CSS 2.1 §10.5). In a column whose height is
 * its content's, the list keeps its 36px, so the root's percentage takes it. A 100px column whose list
 * grows stretches the list past 36px, and a list 36px dense that grows only in the comfortable
 * density does so there, so neither keeps the length it declares. A root whose height is a length
 * records nothing. A root of `auto` height in the list, a flex row on one line, records the fact the
 * same way, since the row stretches it to its content height (CSS Flexbox 1 §9.4); in a row that wraps,
 * or a block list, it records nothing.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { measuredFacts } from "./page-facts.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
});

afterAll(async () => {
  await browser.close();
});

/** Whether the root records `basisAsDeclared`, given the column's style, the list's style and class, and the root's height. */
async function asDeclared(spec: {
  column?: string;
  list?: string;
  listClass?: string;
  height?: string;
}): Promise<boolean> {
  const { column = "", list = "", listClass = "", height = "calc(100% - 1px)" } = spec;
  await page.setContent(
    `<style>body{margin:0} :root[data-density="comfortable"] .grows{flex-grow:1!important}</style><main data-compare-cell><div style="display:flex;flex-direction:column;${column}"><div class="${listClass}" style="display:flex;height:36px;padding:4px;box-sizing:border-box;${list}"><div id="root" style="width:20px;height:${height}"></div></div></div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root: document } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: document.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return facts.get("")?.basisAsDeclared === true;
}

describe("a root's percentage height the capture measures against a length", () => {
  it.each([
    ["in a column of its content's height", {}, true],
    ["in a 100px column that grows the list", { column: "height:100px", list: "flex-grow:1" }, false],
    [
      "in a 100px column that grows the list only comfortable",
      { column: "height:100px", listClass: "grows" },
      false,
    ],
    ["of a length of its own", { height: "20px" }, false],
  ])("%s: %s", async (_, spec, expected) => {
    expect(await asDeclared(spec)).toBe(expected);
  });
});

describe("a root of auto height the capture measures against the row that stretches it", () => {
  it.each([
    ["in a flex row on one line", {}, true],
    ["in a flex row on one line that a column grows", { column: "height:100px", list: "flex-grow:1" }, false],
    ["in a flex row that wraps", { list: "flex-wrap:wrap" }, false],
    ["in a block list", { list: "display:block" }, false],
  ])("%s", async (_, spec, expected) => {
    expect(await asDeclared({ ...spec, height: "auto" })).toBe(expected);
  });
});
