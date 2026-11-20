/**
 * Unit under test: `measuredFacts`, the capture's page function, for the axes along which it records
 * an absolute element one length in every mode (`oneLength`). Oracle: Chromium's layout of markup
 * built for each case, whose lengths the cases' styles set by hand: a 24px close that the comfortable
 * density widens to 32px, as `control-h-sm` widens Dialog's close, differs across and keeps its
 * height; one that the branded identity makes taller keeps its width; a badge whose text and padding
 * no mode changes keeps both lengths; a close that the
 * comfortable density grows on both axes keeps neither; and an element in flow is no candidate.
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

/**
 * Measure a `relative` root around one element with the given style, and rules for the page's head.
 * Returns the facts the page records at the element, and the element's width and height in each
 * density, which the case's rules set.
 */
async function measure(style: string, head = "") {
  await page.setContent(
    `<!doctype html><style>body { margin: 0; font: 12px/16px sans-serif } ${head}</style><main data-compare-cell><div id="root" style="position: relative; width: 200px; height: 100px"><span id="part" style="${style}">12</span></div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root: tree } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: tree.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  const lengths = await page.evaluate(() =>
    ["dense", "comfortable"].map((density) => {
      document.documentElement.setAttribute("data-density", density);
      const box = document.getElementById("part")?.getBoundingClientRect();
      document.documentElement.removeAttribute("data-density");
      return [box?.width, box?.height];
    })
  );
  return { oneLength: facts.get("0")?.oneLength, lengths };
}

const CLOSE = "position: absolute; top: 16px; right: 16px; display: block";

/** The close's 24px size, which a rule for the comfortable density after it overrides. */
const SIZE = "#part { width: 24px; height: 24px }";

describe("the axes the page records an absolute element one length along", () => {
  it("records the height of a close the comfortable density widens", async () => {
    expect(await measure(CLOSE, `${SIZE} html[data-density="comfortable"] #part { width: 32px }`)).toEqual({
      oneLength: ["vertical"],
      lengths: [
        [24, 24],
        [32, 24],
      ],
    });
  });

  it("records the width of a close the branded identity makes taller, in either density", async () => {
    const measured = await measure(
      CLOSE,
      `${SIZE} body[data-theme-identity="branded"] #part { height: 28px }`
    );
    expect(measured.oneLength).toEqual(["horizontal"]);
  });

  it("records both lengths of a badge no mode resizes", async () => {
    const measured = await measure(
      "position: absolute; right: 4px; top: 6px; padding: 0 4px; min-width: 20px"
    );
    expect(measured.oneLength).toEqual(["horizontal", "vertical"]);
    expect(measured.lengths[0]).toEqual(measured.lengths[1]);
  });

  it("records nothing for a close the comfortable density grows on both axes", async () => {
    expect(
      await measure(CLOSE, `${SIZE} html[data-density="comfortable"] #part { width: 32px; height: 32px }`)
    ).toEqual({
      oneLength: undefined,
      lengths: [
        [24, 24],
        [32, 32],
      ],
    });
  });

  it("records nothing for an element in flow", async () => {
    expect((await measure("display: block; width: 24px; height: 24px")).oneLength).toBeUndefined();
  });
});
