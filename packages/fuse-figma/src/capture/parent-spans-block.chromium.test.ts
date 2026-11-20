/**
 * Unit under test: `measuredFacts`, the capture's page function, for which absolute elements it
 * records as placed by a containing block that their static parent spans (`parentSpansBlock`).
 * Oracle: Chromium's own layout of markup built for each case, read through CSS 2.1 §10.1, under
 * which an absolute box's containing block is the padding box of its nearest positioned ancestor.
 * The block is a 200×100 `relative` box with a 1px left border, and the close is 16px from its top
 * and right. Where a static column fills the block, the close sits 16px inside the column's top and
 * right edges, which is what a placed layer at those distances draws in the column's frame, and the
 * page records the fact. A padded block, as Toast's root pads its content, a wrapper that clips, a
 * later sibling of the column, a block whose content sets its height, a positioned column, a wrapper
 * that clips by a path, a close a turn moves, a block above the captured root, a block one density
 * pads, a block whose `::before` paints between the column and the close, and a close followed in
 * its column by a positioned box or a box with an opacity below 1, which Chromium paints over the
 * close while the kit orders the close last, each record nothing. Nor does a column that has the
 * block's size at the sample but not at another size of the block, by a maximum, a `clamp()`, a
 * flex basis, a minimum, a grid track, or an aspect ratio in a block its content sizes, where
 * Chromium then puts the close at another distance from the column's edge than 16px.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { measureMarkup } from "../../test/measured-markup.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
});

afterAll(async () => {
  await browser.close();
});

const BLOCK = "position: relative; width: 200px; height: 100px; border-left: 1px solid black";
const COLUMN = "display: flex; flex-direction: column; width: 100%; height: 100%";
const CLOSE_STYLE = "position: absolute; top: 16px; right: 16px; width: 24px; height: 24px";

/**
 * Measure a block around a column that holds a title and the close: the block's, the column's and
 * the close's styles, a wrapper's style between the block and the column, markup after the column,
 * markup after the close inside the column, rules for the page's head, whether the column is the
 * captured root inside the block, and a style the block takes once the page has measured it.
 * Returns the paths the page records the fact at, the close's distances to its parent's top and
 * right edges and, apart, to its bottom edge, with the block so styled, the element Chromium paints
 * topmost at the close's center, and whether the root's `style` attribute came back as it was.
 */
async function measure(options: {
  readonly block?: string;
  readonly column?: string;
  readonly close?: string;
  readonly wrapper?: string;
  readonly after?: string;
  readonly later?: string;
  readonly head?: string;
  readonly rootIsColumn?: boolean;
  readonly resized?: string;
}) {
  const close = `<button id="close" style="${CLOSE_STYLE}; ${options.close ?? ""}"></button>`;
  const inner = `<p style="margin: 0">Title</p>${close}${options.later ?? ""}`;
  const column = `<div style="${options.column ?? COLUMN}">${inner}</div>`;
  const held = options.wrapper === undefined ? column : `<div style="${options.wrapper}">${column}</div>`;
  const body =
    options.rootIsColumn === true
      ? `<div style="${options.block ?? BLOCK}"><div id="root" style="${options.column ?? COLUMN}">${inner}</div></div>`
      : `<div id="root" style="${options.block ?? BLOCK}">${held}${options.after ?? ""}</div>`;
  const { facts, restored } = await measureMarkup(page, {
    head: options.head ?? "",
    body,
    root: "#root",
    watched: "root",
  });
  const spans = [...facts].flatMap(([path, fact]) => (fact.parentSpansBlock === true ? [path] : []));
  await page.evaluate((resized) => {
    const root = document.getElementById("root");
    if (root !== null) {
      root.style.cssText += resized;
    }
  }, options.resized ?? "");
  const insets = await page.evaluate(() => {
    const button = document.getElementById("close");
    const own = button?.getBoundingClientRect();
    const parent = button?.parentElement?.getBoundingClientRect();
    return own === undefined || parent === undefined
      ? undefined
      : { top: own.top - parent.top, right: parent.right - own.right };
  });
  const bottom = await page.evaluate(() => {
    const button = document.getElementById("close")?.getBoundingClientRect();
    const parent = document.getElementById("close")?.parentElement?.getBoundingClientRect();
    return button === undefined || parent === undefined ? undefined : parent.bottom - button.bottom;
  });
  const topmost = await page.evaluate(() => {
    const own = document.getElementById("close")?.getBoundingClientRect();
    return own === undefined
      ? undefined
      : document.elementFromPoint(own.left + own.width / 2, own.top + own.height / 2)?.id;
  });
  return { spans, insets, bottom, topmost, restored };
}

describe("the absolute elements the page records as placed by a block their parent spans", () => {
  it("records the close of a static column that fills its block, 16px inside the column's corner", async () => {
    expect(await measure({})).toEqual({
      spans: ["0/1"],
      insets: { top: 16, right: 16 },
      bottom: 60,
      topmost: "close",
      restored: true,
    });
  });

  it.each([
    [
      "a padded block, as Toast's root pads its content",
      { block: `${BLOCK}; padding: 12px; box-sizing: border-box` },
    ],
    ["a wrapper that clips", { wrapper: "width: 100%; height: 100%; overflow: hidden" }],
    ["a later sibling of the column", { after: `<div style="height: 0"></div>` }],
    [
      "a block whose content sets its height, against which the column's 100% height is auto",
      { block: "position: relative; width: 200px; border-left: 1px solid black", head: "p { height: 60px }" },
    ],
    ["a positioned column, which is the block itself", { column: `${COLUMN}; position: relative` }],
    ["a wrapper that clips by a path", { wrapper: "width: 100%; height: 100%; clip-path: inset(0)" }],
    ["a close a turn moves off its offsets", { close: "rotate: 180deg" }],
    ["a block above the captured root, which the set does not draw", { rootIsColumn: true }],
    [
      "a block one density pads",
      { head: `html[data-density="comfortable"] #root { padding-top: 8px; box-sizing: border-box }` },
    ],
  ])("records nothing for %s", async (_case, options) => {
    const measured = await measure(options);
    expect([measured.spans, measured.restored]).toEqual([[], true]);
  });

  it("records nothing for a block whose ::before Chromium paints under the close and over the column", async () => {
    const measured = await measure({
      head: `#root::before { content: ""; position: absolute; inset: 0; background: white }`,
    });
    expect([measured.spans, measured.topmost, measured.restored]).toEqual([[], "close", true]);
  });

  it.each([
    [
      "a positioned box",
      `<div style="flex: 1"><div id="later" style="position: relative; height: 100%"></div></div>`,
    ],
    [
      "a box with an opacity below 1",
      `<div style="flex: 1"><div id="later" style="opacity: 0.5; height: 100%"></div></div>`,
    ],
  ])(
    "records nothing for a close followed in its column by %s, which Chromium paints over the close",
    async (_case, later) => {
      const measured = await measure({ later });
      expect([measured.spans, measured.topmost, measured.restored]).toEqual([[], "later", true]);
    }
  );

  it("records nothing for a column whose aspect ratio sets its height in a block its content sizes", async () => {
    const measured = await measure({
      block: "position: relative; width: 200px; border-left: 1px solid black",
      column: `${COLUMN}; aspect-ratio: 1; min-width: 0; min-height: 0`,
      close: "top: auto; bottom: 16px",
      resized: "min-height: 300px",
    });
    expect([measured.spans, measured.bottom, measured.restored]).toEqual([[], -84, true]);
  });

  it.each([
    ["a maximum width", { column: `${COLUMN}; max-width: 220px` }, "width: 250px", -14],
    ["a clamped width", { column: `${COLUMN}; width: clamp(0px, 100%, 220px)` }, "width: 250px", -14],
    [
      "a fixed flex basis",
      {
        block: `${BLOCK}; display: flex`,
        column: `${COLUMN}; flex-basis: 220px; min-width: 0; min-height: 0`,
      },
      "width: 250px",
      -14,
    ],
    ["a minimum width", { column: `${COLUMN}; min-width: 150px` }, "width: 100px", 66],
    [
      "a grid track",
      {
        block: `${BLOCK}; display: grid; grid-template-columns: minmax(0, 220px)`,
        column: `${COLUMN}; min-width: 0; min-height: 0`,
      },
      "width: 250px",
      -14,
    ],
  ])(
    "records nothing for a column %s holds to the block's size only near the sample",
    async (_case, options, resized, right) => {
      const measured = await measure({ ...options, resized });
      expect([measured.spans, measured.insets, measured.restored]).toEqual([[], { top: 16, right }, true]);
    }
  );
});
