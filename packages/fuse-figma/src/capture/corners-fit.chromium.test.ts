/**
 * Unit under test: `measuredFacts`, the capture's page function, for whether a box holds its
 * corners across (`cornersFit`). Oracle: Chromium's layout of a one-cell table whose widths the
 * cases' styles set by hand: a 40px box with a 15px top left corner is wider than twice the radius
 * by more than 2px, whether it lays out as a table cell or a block, and a 31px cell is not. A
 * content-box cell 20px wide with 6px of padding on each side is 32px wide, at the clearance, and a
 * border-box cell 31px wide holds its padding inside that, so it is not. A cell that lays out no box
 * records nothing. A mode
 * whose identity squares every corner leaves no radius to hold, so it decides nothing. A cell whose
 * width the comfortable density narrows, a cell whose four corners are one, and a 20px cell in a
 * table that `scale(2)` draws 40px wide record nothing: CSS lays the radii out on the untransformed
 * box, so a transform moves neither the scaling nor the cap. A block whose 50px of content widens
 * it holds the corner, and one a `max-width: 20px` holds narrower than that content does not.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { measuredFacts } from "./page-facts.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 600, height: 400 } });
});

afterAll(async () => {
  await browser.close();
});

/** Measure a one-cell table whose cell takes the given style, and return what the page records there. */
async function cornersFit(cell: string, head = ""): Promise<true | undefined> {
  await page.setContent(
    `<!doctype html><style>body { margin: 0; font: 12px/16px sans-serif } ${head}</style><main data-compare-cell><table id="root" style="border-spacing: 0"><tbody><tr><td id="cell" style="${cell}"></td></tr></tbody></table></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root: tree } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: tree.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId, "root", ["0/0/0"]);
  await cdp.detach();
  return facts.get("0/0/0")?.cornersFit;
}

/** Content 50px wide, past the 32px a 15px corner needs, in the cell. */
const WIDE = '#cell::before { content: ""; display: block; width: 50px; height: 1px }';

describe("whether a box holds its corners across", () => {
  it.each([
    ["a cell", "padding: 0; width: 40px; border-top-left-radius: 15px", ""],
    ["a block", "display: block; padding: 0; width: 40px; border-top-left-radius: 15px", ""],
    [
      "a content-box cell its padding takes to the clearance",
      "padding: 0 6px; width: 20px; border-top-left-radius: 15px",
      "",
    ],
    [
      "a cell the branded identity squares",
      "padding: 0; width: 40px; border-top-left-radius: 15px",
      'body[data-theme-identity="branded"] #cell { border-top-left-radius: 0 !important }',
    ],
    ["a block its 50px of content widens", "display: block; padding: 0; border-top-left-radius: 15px", WIDE],
  ])("records %s wider than twice its largest corner by the clearance", async (_case, cell, head) => {
    expect(await cornersFit(cell, head)).toBe(true);
  });

  it.each([
    [
      "a cell within the clearance of twice its corner",
      "padding: 0; width: 31px; border-top-left-radius: 15px",
      "",
    ],
    [
      "a cell the comfortable density narrows",
      "padding: 0; width: 40px; border-top-left-radius: 15px",
      'html[data-density="comfortable"] #cell { width: 20px !important }',
    ],
    ["a cell whose four corners are one", "padding: 0; width: 40px; border-radius: 15px", ""],
    [
      "a border-box cell within the clearance, its padding inside its width",
      "box-sizing: border-box; padding: 0 6px; width: 31px; border-top-left-radius: 15px",
      "",
    ],
    ["a cell that lays out no box", "display: none; width: 40px; border-top-left-radius: 15px", ""],
    [
      "an inline box, whose width CSS ignores",
      "display: inline; padding: 0; width: 80px; border-top-left-radius: 15px",
      "",
    ],
    [
      "a cell within the clearance that a scaled table draws wider",
      "padding: 0; width: 20px; border-top-left-radius: 15px",
      "#root { transform: scale(2); transform-origin: 0 0 }",
    ],
    [
      "a block a 20px maximum width holds narrower than its 50px of content",
      "display: block; padding: 0; max-width: 20px; border-top-left-radius: 15px",
      WIDE,
    ],
  ])("records nothing on %s", async (_case, cell, head) => {
    expect(await cornersFit(cell, head)).toBeUndefined();
  });
});
