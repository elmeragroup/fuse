/**
 * Unit under test: `measuredFacts`, the capture's page function, for the width it records beside a
 * block that spans its parent (`spansBeside`). Oracle: Chromium's layout of markup built for each
 * case, whose widths the cases' styles set by hand: a `width: 100%` header in a `fit-content` card
 * beside a 252px grid records 252, as Calendar's header does; a grid the comfortable density widens
 * to 280px, a grid with a margin, a parent that is a flex column, and a header at less than the whole
 * width record nothing, in the page's own mode or only in the modes a density rule reaches.
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

/** The grid's 252px width, which a rule for the comfortable density after it can override. */
const GRID = "#grid { width: 252px; height: 20px }";

/** A header in a card that fits its content, beside a grid, with styles for each and the page's head. */
type Card = {
  readonly card?: string;
  readonly header?: string;
  readonly grid?: string;
  readonly head?: string;
};

/** Measure the card's facts, and return what the page records at the header. */
async function besideHeader({
  card = "display: block; width: fit-content",
  header = "display: flex; width: 100%",
  grid = "display: block",
  head = GRID,
}: Card = {}) {
  await page.setContent(
    `<!doctype html><style>body { margin: 0; font: 12px/16px sans-serif } ${head}</style><main data-compare-cell><div id="root" style="${card}"><div id="header" style="${header}"><span>October 2026</span></div><div id="grid" style="${grid}"></div></div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root: tree } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: tree.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return facts.get("0")?.spansBeside;
}

describe("the width the page records beside a block that spans its parent", () => {
  it("records the grid's width beside a header that spans a card fitting its content", async () => {
    expect(await besideHeader()).toBe(252);
  });

  it.each<readonly [string, Card]>([
    [
      "a grid the comfortable density widens",
      { head: `${GRID} html[data-density="comfortable"] #grid { width: 280px }` },
    ],
    ["a grid with a margin", { grid: "display: block; margin-left: 8px" }],
    ["a card that is a flex column", { card: "display: flex; flex-direction: column; width: fit-content" }],
    ["a header at half the card's width", { header: "display: flex; width: 50%" }],
    // The page starts with no density, so a rule for one density holds only in the modes it stamps.
    [
      "a header the comfortable density halves",
      { head: `${GRID} html[data-density="comfortable"] #header { width: 50% !important }` },
    ],
    [
      "a card the comfortable density makes a flex column",
      {
        head: `${GRID} html[data-density="comfortable"] #root { display: flex !important; flex-direction: column }`,
      },
    ],
  ])("records nothing beside %s", async (_case, card) => {
    expect(await besideHeader(card)).toBeUndefined();
  });
});
