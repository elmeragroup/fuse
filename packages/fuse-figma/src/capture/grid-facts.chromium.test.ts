/**
 * Unit under test: the page function's `gridHugs` and `gridHolds`, through `measuredFacts`. Oracle:
 * Chromium's own grid layout (CSS Grid 1 §11), of items whose widths are fixed lengths, so no font
 * metric decides a column. In a 200px grid of `auto minmax(0, 1fr)` over items 30px and 10px wide,
 * then 20px and 10px, the `auto` column is its widest item's 30px, since the flexible column takes
 * the free space (§11.7), and the flexible one is 170px, wider than its items. In a 200px grid of
 * `auto auto` the free space stretches both `auto` columns past their items (§11.8), so neither hugs.
 * In a 40px grid of two `minmax(0, 1fr)` columns over 30px items, each column is 20px, narrower than
 * its items. A grid whose first column is a fixed 50px in the comfortable density only hugs nothing,
 * since the fact must hold in every mode the capture renders. A column holds its items only with
 * the page's 2px clearance past their min-content width, and an item sets its track only where it is
 * the track's one item or leads every other by that clearance, since the platforms' fonts set the
 * same word up to 1.59px apart. A track of text counts as hugging only where it follows the text
 * one character longer: an `auto` column does, and a fixed track exactly as wide as the word does
 * not (CSS Grid 1 §7.2). Each track's longest item is the one
 * longest at its own length, its alignment at `start`, never at the track's length a stretch gives
 * every item in it (CSS Box Alignment 3 §6.1).
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

/** The facts the page function records on a grid of the given style around the given items. */
async function factsOf(grid: string, items: string, style = "") {
  await page.setContent(
    `<style>${style}</style><main data-compare-cell><div id="root" style="display:grid;${grid}">${items}</div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = (await measuredFacts(cdp, nodeId)).get("");
  await cdp.detach();
  return facts;
}

/** The grid facts the page function records on a grid of the given style over items of the given widths. */
async function gridFacts(grid: string, widths: readonly number[], style = "") {
  const items = widths.map((width) => `<div style="width:${String(width)}px;height:10px"></div>`).join("");
  const facts = await factsOf(grid, items, style);
  return { hugs: facts?.gridHugs, holds: facts?.gridHolds };
}

describe("a grid's columns as the capture measures them", () => {
  it.each([
    ["width:200px;grid-template-columns:auto minmax(0,1fr)", [30, 10, 20, 10], { hugs: [0], holds: [1] }],
    ["width:200px;grid-template-columns:auto auto", [30, 10, 20, 10], { hugs: undefined, holds: [0, 1] }],
    [
      "width:40px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)",
      [30, 30],
      { hugs: undefined, holds: undefined },
    ],
  ])("in a grid %s over items %o: %o", async (grid, widths, expected) => {
    expect(await gridFacts(grid, widths)).toEqual(expected);
  });

  it("keeps no hugging column that a mode the capture does not render widens", async () => {
    const comfortable =
      ':root[data-density="comfortable"] #root { grid-template-columns: 50px minmax(0,1fr) !important }';
    const facts = await gridFacts(
      "width:200px;grid-template-columns:auto minmax(0,1fr)",
      [30, 10, 20, 10],
      comfortable
    );
    expect(facts).toEqual({ hugs: undefined, holds: [1] });
  });

  it("names each track's longest item at its own length, not at the length a stretch gives it", async () => {
    // The first column holds a box of no width of its own around a 20px block, which the column's
    // stretch widens to the 30px square below it, and the second a 10px box above a 40px one. The
    // first row's 10px-tall box sits beside a box of no height around a 25px block, which the row's
    // stretch makes as tall as itself; the second row's boxes are 30px and 10px tall.
    const items = [
      '<div><div style="width:20px;height:10px"></div></div>',
      '<div style="width:10px"><div style="height:25px"></div></div>',
      '<div style="width:30px;height:30px"></div>',
      '<div style="width:40px;height:10px"></div>',
    ].join("");
    const facts = await factsOf("width:200px;grid-template-columns:auto auto", items);
    expect([facts?.gridWidest, facts?.gridTallest]).toEqual([
      [2, 3],
      [1, 2],
    ]);
  });

  it("names no setter where an item leads by less than the clearance, and a track's sole item where it is", async () => {
    // A 30px and a 29px box share the first column, a 1px lead the platforms' fonts could reverse.
    const close = await factsOf(
      "width:200px;grid-template-columns:auto auto",
      [30, 10, 29, 10].map((width) => `<div style="width:${String(width)}px;height:10px"></div>`).join("")
    );
    const sole = await factsOf(
      "width:200px;grid-template-columns:auto auto",
      [30, 10].map((width) => `<div style="width:${String(width)}px;height:10px"></div>`).join("")
    );
    expect([close?.gridWidest, sole?.gridWidest]).toEqual([undefined, [0, 1]]);
  });

  it("counts a column of text as hugging only where it follows a longer text, as an auto column does", async () => {
    const word = '<div style="white-space:nowrap">Selection</div><div style="width:10px;height:10px"></div>';
    const auto = await factsOf(
      "width:300px;font:14px/20px sans-serif;grid-template-columns:auto minmax(0,1fr)",
      word
    );
    const width = await page.evaluate(
      () => document.querySelector("#root > div")?.getBoundingClientRect().width
    );
    // A fixed track exactly as wide as the word keeps its length when the word grows (CSS Grid 1 §7.2).
    const fixed = await factsOf(
      `width:300px;font:14px/20px sans-serif;grid-template-columns:${String(width)}px minmax(0,1fr)`,
      word
    );
    expect([auto?.gridHugs, fixed?.gridHugs]).toEqual([[0], undefined]);
  });
});
