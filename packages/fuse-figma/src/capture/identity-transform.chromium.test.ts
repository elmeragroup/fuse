/**
 * Unit under test: the page function's `identityTransform`, as `measuredFacts` reads the DOM in
 * Chromium. Oracle: CSS Transforms 1 §8 and CSSOM's resolved `transform`, which Chromium gives as the
 * matrix a transform list composes to, and as `none` where the element sets none. Toast's resting
 * `translateY(calc(0px - (1 * (0 * .75rem))))` with `scale(calc(max(0, 1 - (0 * .1))))` composes to
 * the identity, and a translation by 1px does not. A transform that moves the element in one mode
 * only, here 2px at the comfortable density, records nothing, and neither does an element with no
 * transform.
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

/** Whether a root with the given `transform` and class records `identityTransform`. */
async function identity(transform: string, className = ""): Promise<boolean> {
  await page.setContent(
    `<style>body{margin:0} :root[data-density="comfortable"] .moves{transform:translateX(2px)!important}</style><main data-compare-cell><div id="root" class="${className}" style="width:20px;height:20px;transform:${transform}"></div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root: document } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: document.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return facts.get("")?.identityTransform === true;
}

describe("a transform the capture measures as the identity in every mode", () => {
  it.each([
    [
      "a nested calc() and max() of a zero index",
      "translateY(calc(0px - (1 * (0 * .75rem)))) scale(calc(max(0, 1 - (0 * .1))))",
      "",
      true,
    ],
    ["a translation by 1px", "translateX(1px)", "", false],
    ["a translation by zero that moves 2px at the comfortable density", "translateX(0px)", "moves", false],
    ["no transform", "none", "", false],
  ])("%s: %s", async (_, transform, className, expected) => {
    expect(await identity(transform, className)).toBe(expected);
  });
});
