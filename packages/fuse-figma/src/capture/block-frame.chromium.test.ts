/**
 * Unit under test: `measuredFacts`, the capture's page function, for which absolute elements it
 * records as drawn in their containing block's frame, above their parent (`blockSteps`).
 * Oracle: Chromium's own layout and paint of markup built for each case, read through CSS 2.1
 * §10.1, under which an absolute box's containing block is the padding box of its nearest
 * positioned ancestor, and Appendix E, under which a later positioned box paints over it. The block
 * is a 200px-wide `relative` box padded 12px with a 1px left border, as Toast's root pads its
 * content, and the close sits 8px from its padding box's top and right, which is what a layer at
 * those distances draws in the block's frame. The page records the steps up to the block: two
 * through a static column, also an isolated one as Toast's content is, and inside a block bordered
 * on the sides the close's offsets measure from; three through a wrapper around the column; and two
 * beside a block `::after` that paints nothing, as Toast's strip below its root, whose clear fill
 * may be written in any color syntax; and two inside a root around the block, beside three boxes
 * Chromium paints under the close. It records nothing where the kit, drawing the close as the
 * block's last layer, would drop or misplace something Chromium shows: a column with an opacity
 * below 1, in every mode or in one density only, a column a transform makes the block, a column
 * that clips, a hidden column around a visible close, a column with a view transition name, a
 * column's `::before`, a block `::after` that paints over the close by a fill or by a backdrop
 * filter, a later positioned box, an earlier box a positive `z-index` raises over the close, also
 * through a `display: contents` wrapper, an earlier box an `order` paints after the close, a close
 * with a `z-index` or with margins, a close or its `::after` that blends inside an isolated column, a
 * close holding a box a negative `z-index` sinks under the column's title, also where a `will-change`
 * names a property that forms no stacking context, a block above the captured root, or one of
 * those three boxes painting over the close: a box of the block that a 3D context moves towards the
 * viewer, an open popover outside the captured root, or a sibling of the block that a positive
 * `z-index` raises. Where Chromium paints another box at the close's center, the case reads it there.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
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

const BLOCK = "position: relative; width: 200px; padding: 12px; border-left: 1px solid black";
const COLUMN = "display: flex; flex-direction: column";
const CLOSE_STYLE = "position: absolute; top: 8px; right: 8px; width: 24px; height: 24px";

/** What a case sets around the close. */
type Case = {
  /** The block's style after its own. */
  readonly block?: string;
  /** The column's style after its own. */
  readonly column?: string;
  /** The close's style after its own. */
  readonly close?: string;
  /** Markup inside the close. */
  readonly inside?: string;
  /** A wrapper's style around the column. */
  readonly wrapper?: string;
  /** Markup before the title in the column. */
  readonly before?: string;
  /** Markup after the close in the column. */
  readonly later?: string;
  /** Rules for the page's head. */
  readonly head?: string;
  /** Whether the column is the captured root inside the block. */
  readonly rootIsColumn?: boolean;
  /** Markup before the block inside a positioned captured root around it. */
  readonly beside?: string;
  /** Markup inside the block before the column. */
  readonly blockFirst?: string;
  /** Markup after the compared cell, outside the captured root. */
  readonly after?: string;
  /** What runs on the page once the markup has loaded, before the page measures it. */
  readonly prepare?: () => Promise<void>;
};

/**
 * Measure a block around a column that holds a title and the close. Returns the steps the page
 * records at each path, the close's distances to the block's top and right border edges, the element
 * Chromium paints topmost at the close's center, and whether the block's `style` attribute came back
 * as it was.
 */
async function measure(options: Case) {
  const close = `<button id="close" style="${CLOSE_STYLE}; ${options.close ?? ""}">${options.inside ?? ""}</button>`;
  const inner = `${options.before ?? ""}<p style="margin: 0; height: 40px">Title</p>${close}${options.later ?? ""}`;
  const column = `<div style="${COLUMN}; ${options.column ?? ""}">${inner}</div>`;
  const held = options.wrapper === undefined ? column : `<div style="${options.wrapper}">${column}</div>`;
  const block = `${BLOCK}; ${options.block ?? ""}`;
  const blocked = `<div id="block" style="${block}">${options.blockFirst ?? ""}${held}</div>`;
  const body =
    options.rootIsColumn === true
      ? `<div id="block" style="${block}"><div id="root" style="${COLUMN}; ${options.column ?? ""}">${inner}</div></div>`
      : options.beside === undefined
        ? blocked
        : `<div id="root" style="position: relative">${options.beside}${blocked}</div>`;
  const { facts, restored } = await measureMarkup(page, {
    head: options.head ?? "",
    body,
    root: options.rootIsColumn === true || options.beside !== undefined ? "#root" : "#block",
    watched: "block",
    after: options.after ?? "",
    prepare: async () => {
      await options.prepare?.();
    },
  });
  const framed = [...facts].flatMap(([path, fact]) =>
    fact.blockSteps === undefined ? [] : [[path, fact.blockSteps] as const]
  );
  const read = await page.evaluate(() => {
    const button = document.getElementById("close")?.getBoundingClientRect();
    const outer = document.getElementById("block")?.getBoundingClientRect();
    return button === undefined || outer === undefined
      ? undefined
      : {
          insets: { top: button.top - outer.top, right: outer.right - button.right },
          topmost: document.elementFromPoint(button.left + button.width / 2, button.top + button.height / 2)
            ?.id,
        };
  });
  return { framed, insets: read?.insets, topmost: read?.topmost, restored };
}

/** The color Chromium paints at the close's center, once a case is measured. */
async function closePixel(): Promise<readonly number[]> {
  const box = await page.locator("#close").boundingBox();
  if (box === null) {
    throw new Error("the page shows no close");
  }
  const shot = PNG.sync.read(
    await page.screenshot({
      clip: { x: box.x + box.width / 2, y: box.y + box.height / 2, width: 1, height: 1 },
    })
  );
  return [...shot.data.subarray(0, 3)];
}

describe("the absolute elements the page records as drawn in their containing block's frame", () => {
  it("records two steps for a close in a static column, 8px inside the block's padding box", async () => {
    expect(await measure({})).toEqual({
      framed: [["0/1", 2]],
      insets: { top: 8, right: 8 },
      topmost: "close",
      restored: true,
    });
  });

  it.each([
    ["an isolated column, as Toast's content is", { column: "isolation: isolate" }, { top: 8, right: 8 }],
    [
      "a block bordered on the close's sides, past which its offsets measure",
      { block: "border-top: 2px solid black; border-right: 3px solid black" },
      { top: 10, right: 11 },
    ],
  ] as const)("records two steps for a close in %s", async (_case, options, insets) => {
    const measured = await measure(options);
    expect([measured.framed, measured.insets, measured.topmost, measured.restored]).toEqual([
      [["0/1", 2]],
      insets,
      "close",
      true,
    ]);
  });

  it("records three steps through a static wrapper around the column", async () => {
    const measured = await measure({ wrapper: "display: block" });
    expect([measured.framed, measured.insets, measured.restored]).toEqual([
      [["0/0/1", 3]],
      { top: 8, right: 8 },
      true,
    ]);
  });

  it.each([
    ["no fill, as Toast's strip below its root", ""],
    ["a clear fill in another color syntax", "background: oklch(0.6 0.2 30 / 0)"],
  ])("records the close beside a block ::after with %s, which paints nothing", async (_case, fill) => {
    const measured = await measure({
      head: `#block::after { content: ""; position: absolute; top: 100%; left: 0; width: 100%; height: 13px; ${fill} }`,
    });
    expect([measured.framed, measured.topmost, measured.restored]).toEqual([[["0/1", 2]], "close", true]);
  });

  it.each([
    [
      "a column with an opacity below 1, which the close leaves behind in the block's frame",
      { column: "opacity: 0.5" },
    ],
    [
      "a column one density gives an opacity below 1",
      { head: `html[data-density="comfortable"] #block > div { opacity: 0.5 }` },
    ],
    ["a column a transform makes the containing block", { column: "transform: translateX(0)" }],
    ["a column that clips", { column: "overflow: hidden" }],
    [
      "a column with a view transition name, which paints its subtree as one captured group",
      { column: "view-transition-name: column" },
    ],
    ["a close with a z-index", { close: "z-index: 1" }],
    ["a block above the captured root, which the set does not draw", { rootIsColumn: true }],
  ])("records nothing for %s", async (_case, options) => {
    const measured = await measure(options);
    expect([measured.framed, measured.restored]).toEqual([[], true]);
  });

  it("records nothing for a hidden column around a visible close, which the kit would hide with the column", async () => {
    const measured = await measure({ column: "visibility: hidden", close: "visibility: visible" });
    expect([measured.framed, measured.topmost, measured.restored]).toEqual([[], "close", true]);
  });

  it("records nothing for a column whose ::before the kit would draw under the close", async () => {
    const measured = await measure({ head: `#block > div::before { content: "a" }` });
    expect([measured.framed, measured.restored]).toEqual([[], true]);
  });

  it.each([
    ["a fill", "background: white"],
    ["a backdrop filter", "backdrop-filter: invert(1)"],
  ])(
    "records nothing for a block ::after that Chromium paints over the close by %s",
    async (_case, paint) => {
      const measured = await measure({
        head: `#block::after { content: ""; position: absolute; inset: 0; ${paint} }`,
      });
      // `elementFromPoint` names a pseudo-element's originating element.
      expect([measured.framed, measured.topmost, measured.restored]).toEqual([[], "block", true]);
    }
  );

  // The later box is itself absolute in the column, with nothing after it, so the page records it.
  it.each([
    [
      "a later positioned box",
      { later: `<div id="later" style="position: absolute; inset: 0"></div>` },
      [["0/2", 2]],
    ],
    [
      "an earlier box a positive z-index raises",
      { before: `<div id="later" style="position: absolute; inset: 0; z-index: 1"></div>` },
      [],
    ],
    [
      "an earlier flex item a positive z-index raises through a display: contents wrapper",
      {
        before: `<div style="display: contents"><div id="later" style="z-index: 1; height: 40px; margin-bottom: -40px; background: white"></div></div>`,
      },
      [],
    ],
    [
      "an earlier box that forms a stacking context and that an order paints after the close",
      {
        before: `<div id="later" style="opacity: 0.99; order: 1; height: 40px; margin-top: -40px; background: white"></div>`,
      },
      [],
    ],
  ] as const)(
    "records nothing for the close beside %s, which Chromium paints over it",
    async (_case, options, others) => {
      const measured = await measure(options);
      expect([measured.framed, measured.topmost, measured.restored]).toEqual([others, "later", true]);
    }
  );

  it.each([
    ["a close", { close: "background: rgb(0 128 255); mix-blend-mode: difference" }],
    [
      "a close's ::after",
      {
        close: "background: transparent; border: 0; padding: 0",
        head: `#close::after { content: ""; position: absolute; inset: 0; background: rgb(0 128 255); mix-blend-mode: difference }`,
      },
    ],
  ])(
    "records nothing for %s that blends inside an isolated column, which paints it otherwise in the block",
    async (_case, options) => {
      const blending = { ...options, block: "background: white" };
      const measured = await measure({ ...blending, column: "isolation: isolate" });
      const isolated = await closePixel();
      // The kit draws the close as the block's layer, where it blends with the block's white fill.
      await measure(blending);
      const lifted = await closePixel();
      expect([measured.framed, measured.restored, isolated, lifted]).toEqual([
        [],
        true,
        [0, 128, 255],
        [255, 127, 0],
      ]);
    }
  );

  it.each([
    ["", ""],
    [", also with a will-change that forms no stacking context", "will-change: width"],
  ])(
    "records nothing for a close holding a box a negative z-index sinks under the column's title%s",
    async (_case, change) => {
      const measured = await measure({
        column: "isolation: isolate",
        head: "#block p { background: white }",
        close: `background: transparent; border: 0; padding: 0; ${change}`,
        inside: `<span style="position: absolute; inset: 0; z-index: -1; background: rgb(0 128 255)"></span>`,
      });
      // Chromium paints the title over the sunk box; the kit, drawing the box inside the close's layer
      // last in the block's frame, would show it.
      expect([measured.framed, measured.restored, await closePixel()]).toEqual([[], true, [255, 255, 255]]);
    }
  );

  it("records nothing for a close with margins, which Chromium sets past its offsets", async () => {
    const measured = await measure({ close: "margin: 4px" });
    // The kit places the close by its offsets alone, 8px from the block's padding edges.
    expect([measured.framed, measured.insets, measured.restored]).toEqual([[], { top: 12, right: 12 }, true]);
  });

  // One page holds three boxes that Chromium paints under the close here: an earlier sibling of the
  // block in the captured root, an earlier box of the block moved 10px towards the viewer, and a
  // closed popover after the cell. Each case changes one of them so that it paints over the close.
  const competing = (change: {
    readonly level?: string;
    readonly space?: string;
    readonly open?: boolean;
  }): Case => ({
    beside: `<div id="beside" style="position: absolute; inset: 0; z-index: ${change.level ?? "auto"}"></div>`,
    block: `transform-style: ${change.space ?? "flat"}`,
    blockFirst: `<div id="deep" style="position: absolute; inset: 0; transform: translateZ(10px)"></div>`,
    after: `<div id="lifted" popover style="inset: 0; margin: 0; width: 100vw; height: 100vh; border: 0"></div>`,
    prepare: async () => {
      if (change.open === true) {
        await page.evaluate(() => document.getElementById("lifted")?.showPopover());
      }
    },
  });

  it("records two steps for a close beside boxes Chromium paints under it, in a root around the block", async () => {
    const measured = await measure(competing({}));
    expect([measured.framed, measured.topmost, measured.restored]).toEqual([[["1/1/1", 2]], "close", true]);
  });

  it.each([
    [
      "an earlier box of the block that a 3D context moves towards the viewer",
      { space: "preserve-3d" },
      "deep",
    ],
    ["an open popover outside the captured root, in the top layer", { open: true }, "lifted"],
    ["an earlier sibling of the block that a positive z-index raises", { level: "1" }, "beside"],
  ] as const)("records nothing for a close under %s", async (_case, change, over) => {
    const measured = await measure(competing(change));
    expect([measured.framed, measured.topmost, measured.restored]).toEqual([[], over, true]);
  });
});
