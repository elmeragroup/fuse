/**
 * Unit under test: `measuredFacts`, the capture's page function, for which of an element's
 * `::before` and `::after` it records as absolute boxes laid out against the element
 * (`pseudoBoxes`). Oracle: Chromium's own pixels. A 40px root holds a pseudo-element that paints a
 * blue 4px square 10px in from its top left. Where the square is an absolute box against the root,
 * the pixel at its centre is blue and the page records it. Where the pseudo-element generates no
 * box, the pixel stays white and the page records nothing. Where it paints but sits in the root's
 * flow, or its containing block lies above the root, the page records nothing, since the build reads
 * the place of an absolute box against its own element only. A box one density turns off records
 * nothing either, since the page keeps the fact only where every mode it stamps holds it.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { measuredFacts } from "./page-facts.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 100, height: 100 } });
});

afterAll(async () => {
  await browser.close();
});

const SQUARE = "width: 4px; height: 4px; background: blue";

/**
 * The pixel at the square's centre, 12px in from the root's top left, and the pseudo-elements the
 * page records for the root.
 */
async function measure(root: string, pseudo: string) {
  await page.setContent(
    `<style>body { margin: 0; background: white } #root { width: 40px; height: 40px; ${root} } #root::${pseudo}</style>` +
      `<main data-compare-cell><div id="root"></div></main>`
  );
  const shot = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: 40, height: 40 } }));
  const centre = (12 * 40 + 12) * 4;
  const cdp = await page.context().newCDPSession(page);
  const { root: document } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: document.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return { pixel: [...shot.data.subarray(centre, centre + 3)], boxes: facts.get("")?.pseudoBoxes ?? [] };
}

describe("the pseudo-elements the page records as absolute boxes", () => {
  it("records a painting ::before laid out against its positioned element", async () => {
    const measured = await measure(
      "position: relative",
      `before { content: ""; position: absolute; top: 10px; left: 10px; ${SQUARE} }`
    );
    expect(measured).toEqual({ pixel: [0, 0, 255], boxes: ["before"] });
  });

  it("records a painting ::after too", async () => {
    const measured = await measure(
      "position: relative",
      `after { content: ""; position: absolute; top: 10px; left: 10px; ${SQUARE} }`
    );
    expect(measured).toEqual({ pixel: [0, 0, 255], boxes: ["after"] });
  });

  it.each([
    ["black", "black", [0, 0, 0], ["before"]],
    ["red", "rgb(255, 0, 0)", [255, 0, 0], ["before"]],
    ["fully transparent", "rgba(0, 0, 255, 0)", [255, 255, 255], []],
  ])("judges a %s fill by its alpha alone", async (_name, fill, pixel, boxes) => {
    const measured = await measure(
      "position: relative",
      `before { content: ""; position: absolute; top: 10px; left: 10px; width: 4px; height: 4px; background: ${fill} }`
    );
    expect(measured).toEqual({ pixel, boxes });
  });

  it("records nothing for a pseudo-element that generates no box", async () => {
    const measured = await measure(
      "position: relative",
      `before { content: none; position: absolute; top: 10px; left: 10px; ${SQUARE} }`
    );
    expect(measured).toEqual({ pixel: [255, 255, 255], boxes: [] });
  });

  it("records nothing for a painting pseudo-element in its element's flow", async () => {
    const measured = await measure(
      "position: relative; padding: 10px; box-sizing: border-box",
      `before { content: ""; display: block; ${SQUARE} }`
    );
    expect(measured).toEqual({ pixel: [0, 0, 255], boxes: [] });
  });

  it("records nothing for a pseudo-element one density draws no box for", async () => {
    // The page stamps each density on <html> as it measures, and the comfortable one turns it off.
    const measured = await measure(
      "position: relative",
      `before { content: ""; position: absolute; top: 10px; left: 10px; ${SQUARE} } ` +
        `html[data-density="comfortable"] #root::before { content: none }`
    );
    expect(measured).toEqual({ pixel: [0, 0, 255], boxes: [] });
  });

  it("records nothing where the pseudo-element's containing block lies above its element", async () => {
    const measured = await measure(
      "margin: 0",
      `before { content: ""; position: absolute; top: 10px; left: 10px; ${SQUARE} }`
    );
    expect(measured.boxes).toEqual([]);
  });
});
