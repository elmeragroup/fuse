/**
 * Unit under test: `measuredFacts`, the capture's page function, for which absolute `<svg>` elements
 * it records as painted over by no other box of the captured root (`uncovered`), which lets the kit
 * draw the icon as its box's last layer.
 * Oracle: Chromium's own paint of markup built for each case, read at the icon's centre, and CSS 2.1
 * Appendix E, under which a positioned box or a stacking context after the icon in tree order paints
 * over it, CSS 2.1 §9.9.1, under which a positive `z-index` raises an earlier box over it, and CSS
 * Flexbox 1 §5.4.1, under which an `order` paints an earlier flex item after it. The box is a 100px
 * `relative` flex row and the icon a 16px absolute `<svg>` at its top left, where the row's first
 * flex item also sits, so each box that paints over the icon covers its centre. The page records the
 * fact for an icon alone, over a static box after it and over a positioned box before it, also turned
 * as the open Accordion caret is. It records nothing for each shape a box paints over the icon, nor for
 * two values whose stacking the page cannot tell from computed styles, a `will-change` and a `z-index`
 * on the icon itself, where Chromium still paints the icon on top.
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

const BOX = "position: relative; display: flex; width: 100px; height: 100px";
const ICON = "position: absolute; left: 0; top: 0; width: 16px; height: 16px";
const DOT = "width: 16px; height: 16px; background: red";

/** What a case sets around the icon. */
type Case = {
  /** The icon's style after its own. */
  readonly icon?: string;
  /** Markup before the icon in the box. */
  readonly before?: string;
  /** Markup after the icon in the box. */
  readonly after?: string;
  /** Rules for the page's head. */
  readonly head?: string;
};

/**
 * Measure a box that holds the icon. Returns the paths the page records `uncovered` at, and the id of
 * the element Chromium paints topmost at the icon's centre.
 */
async function measure(options: Case) {
  const icon = `<svg id="icon" viewBox="0 0 16 16" style="${ICON}; ${options.icon ?? ""}"><rect width="16" height="16"/></svg>`;
  const { facts, restored } = await measureMarkup(page, {
    head: options.head ?? "",
    body: `<div id="box" style="${BOX}">${options.before ?? ""}${icon}${options.after ?? ""}</div>`,
    root: "#box",
    watched: "box",
  });
  const paths = [...facts].flatMap(([path, fact]) => (fact.uncovered === true ? [path] : []));
  const topmost = await page.evaluate(() => {
    const box = document.getElementById("icon")?.getBoundingClientRect();
    return box === undefined
      ? undefined
      : document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest("[id]")?.id;
  });
  return { paths, topmost, restored };
}

describe("the absolute icons the page records as painted over by no other box", () => {
  it.each([
    ["alone in its box", {}, ["0"]],
    // CSS paints the in-flow box after the icon before every positioned box (CSS 2.1 Appendix E).
    ["over a static box after it", { after: `<div id="dot" style="${DOT}"></div>` }, ["0"]],
    // The `relative` dot paints before the icon in tree order, at the same level.
    [
      "over a relative part before it in the markup",
      { before: `<div id="dot" style="${DOT}; position: relative"></div>` },
      ["1"],
    ],
    // A `z-index: 0` gives the dot a level, the icon's own `auto` level (CSS 2.1 §9.9.1), and the
    // tie paints them in tree order.
    [
      "over a relative part at level 0 before it",
      { before: `<div id="dot" style="${DOT}; position: relative; z-index: 0"></div>` },
      ["1"],
    ],
    // A half turn makes the icon a stacking context of its own, which still paints last.
    ["turned by half a turn, as the open Accordion caret is", { icon: "rotate: 180deg" }, ["0"]],
  ] as const)("records an icon %s", async (_case, options, paths) => {
    expect(await measure(options)).toEqual({ paths, topmost: "icon", restored: true });
  });

  // Each later box sits at the box's start, under the icon, so Chromium paints it at the icon's
  // centre. A relative box or one a turn or an opacity makes a stacking context paints after the
  // icon in tree order (CSS 2.1 Appendix E, step 8), and so does an absolute box at its static place.
  it.each([
    ["a relative icon after it", `<svg id="dot" style="${DOT}; position: relative"></svg>`],
    ["a turned icon after it", `<svg id="dot" style="${DOT}; rotate: 180deg"></svg>`],
    ["a faded icon after it", `<svg id="dot" style="${DOT}; opacity: 0.5"></svg>`],
    ["a relative part after it", `<div id="dot" style="${DOT}; position: relative"></div>`],
    ["a relative part after it and a label", `<div id="dot" style="${DOT}; position: relative"></div>Share`],
    [
      "an absolute part its offsets do not place, then a static one",
      `<div id="dot" style="${DOT}; position: absolute"></div><div style="${DOT}"></div>`,
    ],
    [
      "a relative part inside a static wrapper after it",
      `<div><div id="dot" style="${DOT}; position: relative"></div></div>`,
    ],
    ["a preserved 3D context after it", `<div id="dot" style="${DOT}; transform-style: preserve-3d"></div>`],
    ["a content-visibility after it", `<div id="dot" style="${DOT}; content-visibility: auto"></div>`],
  ])("records nothing for an icon under %s", async (_case, after) => {
    expect(await measure({ after })).toEqual({ paths: [], topmost: "dot", restored: true });
  });

  it.each([
    // CSS paints flex items in order-modified document order (CSS Flexbox 1 §5.4.1), so the
    // `relative` dot before the icon in the markup paints after it.
    ["an order that paints a relative part before it last", `${DOT}; position: relative; order: 1`],
    // A positive level paints the dot after every box at level 0, the icon included (CSS 2.1 §9.9.1).
    ["a z-index on a relative part before it", `${DOT}; position: relative; z-index: 10`],
  ])("records nothing for an icon under %s", async (_case, dot) => {
    expect(await measure({ before: `<div id="dot" style="${dot}"></div>` })).toEqual({
      paths: [],
      topmost: "dot",
      restored: true,
    });
  });

  // The flow icon takes the row's first 16px, so the icon sits past it, over the dot.
  it("records nothing for an icon under a relative part after it and an icon in the flow", async () => {
    expect(
      await measure({
        icon: "left: 16px",
        after: `<svg style="width: 16px; height: 16px"></svg><div id="dot" style="${DOT}; position: relative"></div>`,
      })
    ).toEqual({ paths: [], topmost: "dot", restored: true });
  });

  // A box that runs a transform animation paints over the icon before it, and the page counts any
  // running animation as one that may make a stacking context.
  it("records nothing for an icon under a part that runs an animation after it", async () => {
    expect(
      await measure({
        head: "@keyframes turn { to { transform: rotate(360deg) } }",
        after: `<div id="dot" style="${DOT}; animation: turn 1s linear infinite"></div>`,
      })
    ).toEqual({ paths: [], topmost: "dot", restored: true });
  });

  // Chromium makes no stacking context for `will-change: scroll-position`, and the page counts every
  // `will-change` as one. A `z-index` on the icon paints it over boxes outside its box, which the kit
  // draws after the box's frame.
  it.each([
    [
      "a will-change after it",
      { after: `<div id="dot" style="${DOT}; will-change: scroll-position"></div>` },
    ],
    ["a z-index on the icon", { icon: "z-index: 1" }],
  ] as const)(
    "records nothing for an icon beside %s, which Chromium still paints on top",
    async (_case, options) => {
      expect(await measure(options)).toEqual({ paths: [], topmost: "icon", restored: true });
    }
  );
});
