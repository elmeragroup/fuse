/**
 * Unit under test: `measuredFacts`, the capture's page function, for which absolute elements it
 * records as placed by a containing block that their static parent spans (`parentSpansBlock`).
 * Oracle: Chromium's own layout and painting of markup built for each case. The close sits 16px
 * inside the corner of a column that fills a 200×100 `relative` block, so its distances to the
 * column's edges are what a placed layer draws. Each box that may paint over the close covers only
 * a 6px strip along the close's left edge, and `elementFromPoint` 3px inside that edge, with every
 * `pointer-events` set to `auto`, names the box Chromium paints topmost there.
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
// The close spans 160px to 184px across the column, so a column item or an absolute box in the block
// with these declarations covers its left 6px and leaves its center bare.
const EDGE_ITEM = "margin-left: 160px; width: 6px";
const EDGE_BOX = "top: 0; bottom: 0; left: 160px; width: 6px";
// A fieldset's ::before over the close's left 6px, where the fieldset's legend holds the block at
// the captured root's corner.
const LEGEND_COVER = `#over::before { content: ""; position: absolute; top: 0; left: 161px; width: 6px; height: 100px }`;

/**
 * Measure a block around a column that holds a title and the close, each option adding styles or
 * markup around them, and `resized` a style the block takes once the page has measured it.
 * Returns the paths the page records the fact at, the close's distances to its parent's top and
 * right edges and, apart, to its bottom edge, with the block resized, the elements Chromium paints
 * topmost 3px inside the close's left edge and at its center, and whether the root's `style`
 * attribute came back as it was.
 */
async function measure(options: {
  readonly block?: string;
  readonly column?: string;
  readonly close?: string;
  readonly wrapper?: string;
  readonly after?: string;
  readonly earlier?: string;
  readonly later?: string;
  readonly head?: string;
  readonly rootIsColumn?: boolean;
  readonly outside?: string;
  readonly overlay?: string;
  readonly popover?: boolean;
  readonly legend?: boolean;
  readonly resized?: string;
}) {
  const close = `<button id="close" style="${CLOSE_STYLE}; ${options.close ?? ""}"></button>`;
  const inner = `<p style="margin: 0">Title</p>${options.earlier ?? ""}${close}${options.later ?? ""}`;
  const column = `<div style="${options.column ?? COLUMN}">${inner}</div>`;
  const held = options.wrapper === undefined ? column : `<div style="${options.wrapper}">${column}</div>`;
  const body =
    options.legend === true
      ? `<div id="root" style="position: relative"><fieldset id="over" style="margin: 0; padding: 0; border: 0; min-width: 0"><legend style="padding: 0"><div style="${BLOCK}">${held}</div></legend></fieldset></div>`
      : options.rootIsColumn === true
        ? `<div style="${options.block ?? BLOCK}"><div id="root" style="${options.column ?? COLUMN}">${inner}</div></div>`
        : options.outside === undefined
          ? `<div id="root" style="${options.block ?? BLOCK}">${held}${options.after ?? ""}</div>`
          : `<div id="root" style="position: relative">${options.outside}<div style="${options.block ?? BLOCK}">${held}</div></div>`;
  const { facts, restored } = await measureMarkup(page, {
    head: `${options.legend === true ? LEGEND_COVER : ""} ${options.head ?? ""}`,
    body,
    after: options.overlay ?? "",
    root: "#root",
    watched: "root",
    prepare: async () => {
      if (options.popover === true) {
        await page.evaluate(() => {
          document.getElementById("over")?.showPopover();
        });
      }
    },
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
  const [edge, center] = await page.evaluate(() => {
    const own = document.getElementById("close")?.getBoundingClientRect();
    const reached = document.createElement("style");
    reached.textContent = "*, ::before, ::after { pointer-events: auto !important }";
    document.head.append(reached);
    const hits =
      own === undefined
        ? []
        : [own.left + 3, own.left + own.width / 2].map(
            (x) => document.elementFromPoint(x, own.top + own.height / 2)?.id
          );
    reached.remove();
    return hits;
  });
  return { spans, insets, bottom, edge, center, restored };
}

describe("the absolute elements the page records as placed by a block their parent spans", () => {
  it("records the close of a static column that fills its block, 16px inside the column's corner", async () => {
    expect(await measure({})).toEqual({
      spans: ["0/1"],
      insets: { top: 16, right: 16 },
      bottom: 60,
      edge: "close",
      center: "close",
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
    expect([measured.spans, measured.edge, measured.center, measured.restored]).toEqual([
      [],
      "close",
      "close",
      true,
    ]);
  });

  it.each([
    [
      "a positioned box",
      {
        later: `<div style="flex: 1; ${EDGE_ITEM}"><div id="later" style="position: relative; height: 100%"></div></div>`,
      },
    ],
    [
      "a box with an opacity below 1",
      {
        later: `<div style="flex: 1; ${EDGE_ITEM}"><div id="later" style="opacity: 0.5; height: 100%"></div></div>`,
      },
    ],
    [
      "a box with an offset path",
      {
        later: `<div id="later" style="flex: none; width: 6px; height: 24px; offset-path: path('M 163 10 L 170 10')"></div>`,
      },
    ],
    [
      "a box with a reflection",
      {
        later: `<div id="later" style="flex: none; height: 24px; -webkit-box-reflect: below 0px; ${EDGE_ITEM}"></div>`,
      },
    ],
    [
      "a scroller with a positioned ::scroll-button",
      {
        later: `<div id="later" style="flex: none; overflow: auto; height: 6px; ${EDGE_ITEM}"></div>`,
        head: `#later::scroll-button(up) { content: ""; position: absolute; ${EDGE_BOX}; margin: 0; padding: 0; border: 0; min-width: 0 }`,
      },
    ],
  ])(
    "records nothing for a close followed in its column by %s, which Chromium paints over the close",
    async (_case, options) => {
      const measured = await measure(options);
      expect([measured.spans, measured.edge, measured.center === measured.edge, measured.restored]).toEqual([
        [],
        "later",
        false,
        true,
      ]);
    }
  );

  it.each([
    [
      "a flex item with a positive z-index inside a `display: contents` box",
      {
        earlier: `<div style="display: contents"><div id="over" style="flex: 1; z-index: 1; ${EDGE_ITEM}"></div></div>`,
      },
    ],
    [
      "a flex item with a positive z-index",
      { earlier: `<div id="over" style="flex: 1; z-index: 1; ${EDGE_ITEM}"></div>` },
    ],
    [
      "a `-webkit-box` item with a positive z-index",
      {
        column: "display: -webkit-box; -webkit-box-orient: vertical; width: 100%; height: 100%",
        earlier: `<div id="over" style="z-index: 1; height: 82px; ${EDGE_ITEM}"></div>`,
      },
    ],
    [
      "a box whose positioned child has a positive z-index",
      {
        earlier: `<div style="flex: 1; ${EDGE_ITEM}"><div id="over" style="position: relative; z-index: 1; height: 100%"></div></div>`,
      },
    ],
    [
      "an in-flow box, where the close's z-index is negative",
      {
        close: "z-index: -1",
        earlier: `<div id="over" style="flex: 1; background: white; ${EDGE_ITEM}"></div>`,
      },
    ],
    [
      "a positioned box at the close's level 0 that `order: 1` paints after the close",
      { earlier: `<div id="over" style="flex: 1; order: 1; position: relative; ${EDGE_ITEM}"></div>` },
    ],
    [
      "a positioned box at the close's level 1 that `order: 1` paints after the close",
      {
        close: "z-index: 1",
        earlier: `<div id="over" style="flex: 1; order: 1; position: relative; z-index: 1; ${EDGE_ITEM}"></div>`,
      },
    ],
    [
      "a box with `will-change: width`, no stacking context, around a positioned child with a positive z-index",
      {
        earlier: `<div style="flex: 1; will-change: width; ${EDGE_ITEM}"><div id="over" style="position: relative; z-index: 1; height: 100%"></div></div>`,
      },
    ],
    [
      "an inline box with a transform, no stacking context, around an absolute child with a positive z-index",
      {
        earlier: `<div style="flex: 1"><span style="transform: translateX(0)"><div id="over" style="position: absolute; ${EDGE_BOX}; z-index: 1"></div></span></div>`,
      },
    ],
    [
      "a positioned box that a 3D context moves in front of the close at the same level",
      {
        column: `${COLUMN}; transform-style: preserve-3d`,
        earlier: `<div id="over" style="position: absolute; ${EDGE_BOX}; transform: translateZ(10px)"></div>`,
      },
    ],
    [
      "a fixed box with a positive z-index in a table row whose `contain: layout` does not apply to it",
      {
        earlier: `<table><tbody><tr style="contain: layout"><td><div id="over" style="position: fixed; top: 16px; left: 161px; width: 6px; height: 24px; z-index: 1"></div></td></tr></tbody></table>`,
      },
    ],
  ])(
    "records nothing for a close after %s in its column, which Chromium paints over the close",
    async (_case, options) => {
      const measured = await measure(options);
      expect([measured.spans, measured.edge, measured.center === measured.edge, measured.restored]).toEqual([
        [],
        "over",
        false,
        true,
      ]);
    }
  );

  it("records nothing for a close at a z-index of 2 followed in its column by a positioned box at 1, which Chromium paints under the close", async () => {
    const measured = await measure({
      close: "z-index: 2",
      later: `<div id="later" style="position: absolute; ${EDGE_BOX}; z-index: 1"></div>`,
    });
    expect([measured.spans, measured.edge, measured.restored]).toEqual([[], "close", true]);
  });

  it("records nothing for a close in a fieldset's legend, under the fieldset's ::before that Chromium paints after the legend", async () => {
    const measured = await measure({ legend: true });
    expect([measured.spans, measured.edge, measured.center, measured.restored]).toEqual([
      [],
      "over",
      "close",
      true,
    ]);
  });

  it.each([
    [
      "a positioned box with a positive z-index before the block in the captured root",
      {
        outside: `<div style="height: 0"><div id="over" style="position: absolute; top: 0; bottom: 0; left: 161px; width: 6px; z-index: 1"></div></div>`,
      },
    ],
    [
      "a positioned box with a z-index of 1 before the block, where the close's 2 holds inside an isolated column",
      {
        outside: `<div style="height: 0"><div id="over" style="position: absolute; top: 0; bottom: 0; left: 161px; width: 6px; z-index: 1"></div></div>`,
        column: `${COLUMN}; isolation: isolate`,
        close: "z-index: 2",
      },
    ],
    [
      "an open popover, in the top layer",
      {
        overlay: `<div id="over" popover style="inset: auto; top: 0; left: 161px; width: 6px; height: 300px; margin: 0; padding: 0; border: 0"></div>`,
        popover: true,
      },
    ],
  ])("records nothing for a close under %s, which Chromium paints over the close", async (_case, options) => {
    const measured = await measure(options);
    expect([measured.spans, measured.edge, measured.center === measured.edge, measured.restored]).toEqual([
      [],
      "over",
      false,
      true,
    ]);
  });

  it("records nothing for a close after a box whose ::before has a positive z-index, which Chromium paints over the close", async () => {
    const measured = await measure({
      earlier: `<div id="over" style="flex: 1"></div>`,
      head: `#over::before { content: ""; position: absolute; ${EDGE_BOX}; z-index: 1 }`,
    });
    expect([measured.spans, measured.edge, measured.center === measured.edge, measured.restored]).toEqual([
      [],
      "over",
      false,
      true,
    ]);
  });

  it("records nothing for a close followed in its column by a box whose positioned ::after Chromium paints over the close", async () => {
    const measured = await measure({
      later: `<div id="later" style="flex: 1"></div>`,
      head: `#later::after { content: ""; position: absolute; ${EDGE_BOX} }`,
    });
    expect([measured.spans, measured.edge, measured.center === measured.edge, measured.restored]).toEqual([
      [],
      "later",
      false,
      true,
    ]);
  });

  it.each([
    [
      "after a positioned box with a z-index of 0",
      { earlier: `<div style="flex: 1; position: relative; z-index: 0"></div>` },
      "0/2",
    ],
    [
      "after a box whose child sets a positive z-index that does not apply to it",
      { earlier: `<div style="flex: 1"><div style="z-index: 1; height: 100%"></div></div>` },
      "0/2",
    ],
    [
      "at a z-index of 2 after a positioned box at 1, both inside an isolated column",
      {
        column: `${COLUMN}; isolation: isolate`,
        close: "z-index: 2",
        earlier: `<div style="flex: 1; position: relative; z-index: 1"></div>`,
      },
      "0/2",
    ],
    [
      "after a positioned box with a positive z-index that `display: none` hides",
      { earlier: `<div style="display: none; position: relative; z-index: 1"></div>` },
      "0/2",
    ],
    [
      "after a box `display: none` hides around a positioned child with a positive z-index",
      { earlier: `<div style="display: none"><div style="position: relative; z-index: 1"></div></div>` },
      "0/2",
    ],
  ])(
    "records the close %s in its column, which Chromium paints under the close",
    async (_case, options, path) => {
      expect(await measure(options)).toMatchObject({ spans: [path], edge: "close", restored: true });
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
