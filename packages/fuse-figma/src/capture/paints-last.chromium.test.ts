/**
 * Unit under test: `measuredFacts`, the capture's page function, for which children of the root it
 * records as painting over every other box of the root by their `z-index` (`paintsLast`).
 * Oracle: Chromium's own painting of markup built for each case, read through CSS 2.1 §9.9.1 and
 * Appendix E and CSS Flexbox 1 §5.4.1, at the centre of an `actions` box that a `cover` overlaps:
 * an absolute box over the whole root, or a flex item of the root at the actions' level. The page
 * records the fact where Chromium paints the actions topmost and no layer after them exists: a
 * `z-index: 20` over a cover at `auto`, over a cover at the same level that comes first in the
 * tree, or over the absolute `::before` at `auto` of a `display: contents` cover whose `z-index`
 * applies to no box. It records nothing where Chromium paints a box over the actions: a cover at a
 * higher level, a static cover at a higher level that is an item of the root's `-webkit-box`, to
 * which Chromium applies `z-index` as to a flex item, a cover's `::before` at a higher level,
 * positioned, a static flex item of the cover, or a flex item of the root where the cover has
 * `display: contents`, the root's static `::before` at a higher level as a flex or a grid item, a
 * `z-index` on a box it does not apply to, a negative level, a cover one density or the dark scheme
 * raises to a higher level, actions in a wrapper whose opacity forms a stacking context at level
 * zero, under a cover at a lower level than the actions', static actions in a `display: contents`
 * wrapper whose `z-index` applies to no box, and a flex item cover at the same level that an
 * `order` paints after the actions: the cover's `order: 1`, light and dark, its `order: 1` in the
 * dark scheme only, and the actions' `order: -1`. Nor where a layer follows the actions while
 * Chromium paints them topmost: a later sibling, later text and the root's `::after`.
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

const ROOT = "position: relative; display: flex; width: 200px; height: 40px";
const COVER = "position: absolute; inset: 0; background: blue";
const ACTIONS = "position: relative; z-index: 20; width: 24px; height: 24px; background: red";
/**
 * A cover at the actions' level that is a flex item of the root, 200px wide with a -200px start
 * margin, so it takes no room in the row and overlaps the item laid out before it.
 */
const ORDERED_COVER =
  "position: relative; z-index: 20; flex-shrink: 0; width: 200px; margin-left: -200px; background: blue";

/**
 * Measure a root that holds a cover, a title and the actions: the root's, the cover's and the
 * actions' styles, a wrapper's style around the actions, markup after the actions, rules for the
 * page's head, and the attributes `<html>` takes once the page has measured, for the mode Chromium
 * paints in. Returns the ids of the root's children the page records the fact on, and the element
 * Chromium paints topmost at the actions' centre, a pseudo-element's being its element's.
 */
async function measure(options: {
  readonly root?: string;
  readonly cover?: string;
  readonly actions?: string;
  readonly wrapper?: string;
  readonly after?: string;
  readonly head?: string;
  readonly mode?: Readonly<Record<string, string>>;
}) {
  const actions = `<div id="actions" style="${options.actions ?? ACTIONS}"></div>`;
  const children = [
    `<div id="cover" style="${options.cover ?? COVER}"></div>`,
    `<p id="title" style="margin: 0; flex: 1">Title</p>`,
    options.wrapper === undefined ? actions : `<div style="${options.wrapper}">${actions}</div>`,
  ];
  await page.setContent(
    `<!doctype html><style>body { margin: 0 } ${options.head ?? ""}</style><main data-compare-cell><div id="root" style="${options.root ?? ROOT}">${children.join("")}${options.after ?? ""}</div></main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root: tree } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: tree.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  const ids = ["cover", "title", "actions"];
  const last = [...facts].flatMap(([path, fact]) =>
    fact.paintsLast === true ? [ids[Number(path)] ?? path] : []
  );
  const topmost = await page.evaluate((mode) => {
    for (const [name, value] of Object.entries(mode ?? {})) {
      document.documentElement.setAttribute(name, value);
    }
    const own = document.getElementById("actions")?.getBoundingClientRect();
    return own === undefined
      ? undefined
      : document.elementFromPoint(own.left + own.width / 2, own.top + own.height / 2)?.id;
  }, options.mode);
  return { last, topmost };
}

describe("measuredFacts paintsLast", () => {
  it.each([
    ["a cover at `auto`", {}],
    ["a cover at the same level, which comes first in the tree", { cover: `${COVER}; z-index: 20` }],
    [
      "an earlier `display: contents` cover at a higher level, which generates no box, whose absolute ::before at `auto` covers the root",
      {
        cover: "display: contents; z-index: 30",
        head: `#cover::before { content: ""; position: absolute; inset: 0; background: blue }`,
      },
    ],
  ])("records the actions over %s, which Chromium paints under them", async (_name, options) => {
    expect(await measure(options)).toEqual({ last: ["actions"], topmost: "actions" });
  });

  it.each([
    ["a cover at a higher level", { cover: `${COVER}; z-index: 30` }],
    [
      "a cover whose ::before takes a higher level",
      { head: `#cover::before { content: ""; position: absolute; inset: 0; z-index: 30 }` },
    ],
    [
      "a level on a box it does not apply to",
      {
        root: "position: relative; width: 200px; height: 40px",
        actions: ACTIONS.replace("relative", "static"),
      },
    ],
    ["a negative level", { actions: ACTIONS.replace("20", "-1") }],
    [
      "a cover one density raises to a higher level",
      {
        head: `html[data-density="comfortable"] #cover { z-index: 30 }`,
        mode: { "data-density": "comfortable" },
      },
    ],
    [
      "a cover the dark scheme raises to a higher level",
      { head: `html[data-theme="dark"] #cover { z-index: 30 }`, mode: { "data-theme": "dark" } },
    ],
    [
      "a `display: contents` cover whose static ::before, a flex item of the root, takes a higher level",
      {
        cover: "display: contents",
        head: `#cover::before { content: ""; flex-shrink: 0; width: 200px; margin-right: -200px; background: blue; z-index: 30 }`,
      },
    ],
    [
      "a cover whose static ::before, a flex item of the cover, takes a higher level",
      { head: `#cover { display: flex } #cover::before { content: ""; flex: 1; z-index: 30 }` },
    ],
    [
      "actions in a wrapper whose opacity forms a stacking context, under a cover at a lower level",
      { wrapper: "opacity: 0.9", cover: `${COVER}; z-index: 10` },
    ],
    [
      "a flex item cover at the same level whose `order` puts it after the actions",
      { cover: `${ORDERED_COVER}; order: 1` },
    ],
    [
      "a flex item cover at the same level that the dark scheme puts after the actions",
      {
        cover: ORDERED_COVER,
        head: `html[data-theme="dark"] #cover { order: 1 }`,
        mode: { "data-theme": "dark" },
      },
    ],
    [
      "actions at the same level whose `order` puts them before a flex item cover",
      { cover: ORDERED_COVER, actions: `${ACTIONS}; order: -1` },
    ],
    [
      "a static cover at a higher level, an item of the root's `-webkit-box`",
      {
        root: "position: relative; display: -webkit-box; width: 200px; height: 40px",
        cover: "z-index: 30; width: 200px; margin-right: -200px; background: blue",
      },
    ],
    [
      "static actions in a `display: contents` wrapper with a level, which generates no box",
      {
        wrapper: "display: contents; z-index: 20",
        actions: ACTIONS.replace("relative; z-index: 20", "static"),
      },
    ],
  ])("records nothing for %s, where Chromium paints the cover over the actions", async (_name, options) => {
    expect(await measure(options)).toEqual({ last: [], topmost: "cover" });
  });

  it.each([
    [
      "the root's static ::before, a flex item, at a higher level",
      {
        head: `#root::before { content: ""; flex-shrink: 0; width: 200px; margin-right: -200px; z-index: 30 }`,
      },
    ],
    [
      "the root's static ::before, a grid item, at a higher level",
      {
        root: "position: relative; display: grid; width: 200px; height: 40px",
        head: `#root::before { content: ""; grid-area: 1 / 1; z-index: 30 } #actions { grid-area: 1 / 1 }`,
      },
    ],
  ])(
    "records nothing for %s, where Chromium paints the root's ::before over the actions",
    async (_name, options) => {
      expect(await measure(options)).toEqual({ last: [], topmost: "root" });
    }
  );

  it.each([
    ["a later sibling", { after: `<div id="later" style="position: absolute; inset: 0"></div>` }],
    ["later text", { after: "Draft" }],
    ["the root's ::after", { head: `#root::after { content: ""; position: absolute; inset: 0 }` }],
  ])(
    "records nothing for %s, which the kit would draw after the actions while Chromium paints them topmost",
    async (_name, options) => {
      expect(await measure(options)).toEqual({ last: [], topmost: "actions" });
    }
  );
});
