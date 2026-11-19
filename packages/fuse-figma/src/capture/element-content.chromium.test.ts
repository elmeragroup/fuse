/**
 * Unit under test: the text `readCell` records for each element, its `text`, `textIndex` and
 * `texts`. Oracle: Chromium's own DOM, whose `textContent` holds every text node below an element in
 * document order (DOM §4.4), white space alone included. DevTools' DOM tree leaves out a text node of
 * white space alone and trims an element's text, so Code's markup, a `<pre>` whose highlighter puts a
 * line feed between its line spans and a space alone in a span, loses that text unless the page reads
 * it.
 */
import type { Browser, CDPSession, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { indexDocument, readCell } from "./read-page.ts";
import type { RawElement } from "./read-page.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

/** An element's text as the capture holds it, its own and its children's, in document order. */
function recorded(element: RawElement): string {
  const index = element.textIndex ?? element.children.length;
  const texts =
    element.texts ??
    Array.from({ length: element.children.length + 1 }, (_, place) => (place === index ? element.text : ""));
  return (
    element.children.map((child, place) => `${texts[place] ?? ""}${recorded(child)}`).join("") +
    (texts.at(-1) ?? "")
  );
}

/** Read the `#root` cell of the given markup, and the DOM's text of its root. */
async function read(markup: string) {
  await page.setContent(`<main data-compare-cell>${markup}</main>`);
  return readPage();
}

/** Read the `#root` cell of the page as it stands, and the DOM's text of its root. */
async function readPage() {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const cell = await readCell(cdp, new Map(), indexDocument(root), "#root", new Map());
  await cdp.detach();
  const dom = await page.evaluate(() => document.querySelector("#root")?.textContent);
  if (cell instanceof Error) {
    throw cell;
  }
  return { cell: cell.root, dom };
}

describe("the text the capture records for an element", () => {
  it("keeps a line feed between Code's line spans and a space alone in a span", async () => {
    const { cell, dom } = await read(
      '<pre id="root"><code><span><span>const</span><span> </span><span>a</span></span>\n<span><span>b</span></span></code></pre>'
    );
    expect([recorded(cell), cell.children[0]?.texts]).toEqual([dom, ["", "\n", ""]]);
  });

  it("keeps text on both sides of an element child", async () => {
    const { cell, dom } = await read('<p id="root">a <b>x</b> c</p>');
    expect([recorded(cell), cell.texts]).toEqual([dom, ["a ", " c"]]);
  });

  it.each([" a ", "\nabc\n", "a\t"])("keeps the white space at the ends of %j in a span", async (text) => {
    const { cell, dom } = await read(`<pre id="root"><span>${text}</span></pre>`);
    expect(recorded(cell)).toBe(dom);
  });

  it("keeps a space between text nodes a script appended next to each other", async () => {
    await page.setContent('<main data-compare-cell><pre id="root"><span></span></pre></main>');
    await page.evaluate(() => {
      const span = document.querySelector("#root span");
      for (const text of ["a", " ", "b"]) {
        span?.append(document.createTextNode(text));
      }
    });
    const { cell, dom } = await readPage();
    expect(recorded(cell)).toBe(dom);
  });

  it("records no texts where the element's text and its place hold all of it", async () => {
    const { cell, dom } = await read('<p id="root"><svg></svg>Price alert</p>');
    expect([recorded(cell), cell.texts]).toEqual([dom, undefined]);
  });
});
