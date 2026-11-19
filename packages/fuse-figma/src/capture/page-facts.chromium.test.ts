/**
 * Unit under test: `measuredFacts`, the capture's page function as it reads the DOM in Chromium, for
 * whether the elements around a root lie exactly behind it (`coincidingAround`). Oracle: Chromium's
 * own pixels. A 100px root with no paint of its own sits in a 100px red wrapper beside one other
 * child the same size, absolute over it. Where that child draws nothing, the root's center shows the
 * wrapper's red, and the wrapper lies behind the root. Where it draws an SVG, a generated `::after`
 * box or an image, the center shows the child's blue, and so does a generated `::after` box of the
 * wrapper's own, so nothing lies exactly behind the root. The center also shows blue under a box that
 * overflows a zero-size child and black under a child whose `backdrop-filter` darkens the red. In a
 * blue wrapper, it shows a child's opaque black or red fill.
 *
 * Some paint lies outside the boxes the page reads, or in no box it reads at all. The center shows
 * blue under the wrapper's own full blocks, indented 250px past the root, whose `text-shadow` moves
 * them back over it; under an SVG set 250px to the right whose 600px stroke reaches back; under the
 * wrapper's own list marker, a 100px blue image; under a child whose `content` replaces it with a
 * blue image; and under a child whose open shadow root holds a blue box. Text ink lands where its
 * font puts it, so for text the oracle is any pixel of the root's box that is not red, under an
 * italic `l` scaled 100 times from 10px beside the root, whose slant leans its top back over it.
 */
import { readFileSync } from "node:fs";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MeasuredFacts } from "./capture-format.ts";
import { measuredFacts } from "./page-facts.ts";

const BLUE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

const STYLE = `
  body { margin: 0 }
  .wrapper { position: relative; width: 100px; height: 100px; background: red }
  #root { width: 100px; height: 100px }
  .over { position: absolute; inset: 0; width: 100px; height: 100px }
  .generates::after { content: ""; position: absolute; inset: 0; background: blue }
  .shadowed { color: blue; font: 100px/100px sans-serif; white-space: nowrap; text-indent: 250px; text-shadow: -250px 0 blue }
  .shadowed #root { position: absolute; inset: 0 }
  .marked { display: list-item; list-style: inside url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='blue'/%3E%3C/svg%3E") }
  .marked #root { position: absolute; inset: 0 }
  .blue { background: blue }
`;

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 200, height: 200 } });
});

afterAll(async () => {
  await browser.close();
});

/** The root's 100px box as Chromium paints it, and how many elements the page function finds behind the root. */
async function render(wrapperClass: string, sibling: string) {
  await page.setContent(
    `<style>${STYLE}</style><main data-compare-cell><div class="wrapper ${wrapperClass}"><div id="root"></div>${sibling}</div></main>`
  );
  // SAFETY: the locator matches `<img>` elements only.
  await page
    .locator("img")
    .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
  const shot = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: 100, height: 100 } }));
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return { shot, coinciding: facts.get("")?.coincidingAround ?? 0 };
}

/** The root's center pixel as Chromium paints it, and how many elements the page function finds behind the root. */
async function behind(wrapperClass: string, sibling: string) {
  const { shot, coinciding } = await render(wrapperClass, sibling);
  const center = (50 * 100 + 50) * 4;
  return { pixel: [...shot.data.subarray(center, center + 3)], coinciding };
}

/**
 * Whether Chromium paints the root's whole box in the wrapper's red, and how many elements the page
 * function finds behind the root. Text whose ink lands somewhere in the box, wherever its font puts
 * it, shows there as a pixel that is not red.
 */
async function allRed(wrapperClass: string, sibling: string) {
  const { shot, coinciding } = await render(wrapperClass, sibling);
  const red = Array.from({ length: 100 * 100 }, (_, index) => index * 4).every(
    (at) => shot.data[at] === 255 && shot.data[at + 1] === 0 && shot.data[at + 2] === 0
  );
  return { red, coinciding };
}

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];

describe("the elements the capture finds lying exactly behind a root", () => {
  it("include a wrapper whose other child draws nothing, so the root shows its red", async () => {
    expect(await behind("", '<div class="over"></div>')).toEqual({ pixel: RED, coinciding: 1 });
  });

  it("exclude one whose other child is an SVG that paints blue over the root", async () => {
    expect(
      await behind("", '<svg class="over" viewBox="0 0 1 1"><rect width="1" height="1" fill="blue"/></svg>')
    ).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose other child generates an ::after box that paints blue over the root", async () => {
    expect(await behind("", '<div class="over generates"></div>')).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose other child is an image that paints blue over the root", async () => {
    expect(await behind("", `<img class="over" src="${BLUE_PNG}">`)).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one that generates an ::after box of its own, which paints blue over the root", async () => {
    expect(await behind("generates", "")).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose other child has no size but holds a box that overflows it in blue over the root", async () => {
    expect(
      await behind("", '<div style="width:0;height:0"><div class="over" style="background:blue"></div></div>')
    ).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose own text, off the root, casts a blue shadow back over it", async () => {
    expect(await behind("shadowed", "\u2588\u2588\u2588\u2588")).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose other child's italic letter, scaled from beside the root, leans blue back over it", async () => {
    expect(
      await allRed(
        "",
        '<span style="position:absolute;right:110px;top:-100px;font:italic 10px/10px sans-serif;color:blue;transform:scale(100);transform-origin:top right">l</span>'
      )
    ).toEqual({ red: false, coinciding: 0 });
  });

  it("exclude one whose other child is an SVG, off the root, whose stroke paints blue back over it", async () => {
    expect(
      await behind(
        "",
        '<svg style="position:absolute;left:250px;top:0;width:100px;height:100px;overflow:visible"><rect width="100" height="100" fill="none" stroke="blue" stroke-width="600"/></svg>'
      )
    ).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one that is a list item whose own marker paints blue over the root", async () => {
    expect(await behind("marked", "")).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose other child's content property replaces it with a blue image over the root", async () => {
    expect(await behind("", `<div class="over" style='content:url("${BLUE_PNG}")'></div>`)).toEqual({
      pixel: BLUE,
      coinciding: 0,
    });
  });

  it("exclude one whose other child hosts an open shadow root that paints blue over the root", async () => {
    expect(
      await behind(
        "",
        '<div class="over" id="host"></div><script>document.querySelector("#host").attachShadow({ mode: "open" }).innerHTML = \'<div style="width:100px;height:100px;background:blue"></div>\'; document.currentScript.remove()</script>'
      )
    ).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  // Chromium serializes both fills as \`rgb()\` with a last component of 0, the blue channel, which a
  // check on that component alone would read as clear. The wrapper is blue here, so the pixel tells
  // the child's fill from the wrapper's.
  it.each([
    ["black", [0, 0, 0]],
    ["red", RED],
  ])("exclude one whose other child fills the root's box in opaque %s", async (fill, pixel) => {
    expect(await behind("blue", `<div class="over" style="background:${fill}"></div>`)).toEqual({
      pixel,
      coinciding: 0,
    });
  });

  it("exclude one whose other child filters the red behind it to black", async () => {
    expect(await behind("", '<div class="over" style="backdrop-filter:brightness(0)"></div>')).toEqual({
      pixel: [0, 0, 0],
      coinciding: 0,
    });
  });
});

/**
 * Unit under test: `measuredFacts`'s `ellipsisFits`, for a `truncate` span holding `Dashboard` in 14px
 * Arial. Oracle: Chromium's rendering of the same span, read on 2026-11-17 for U3.5: in an 8px box it
 * draws part of the `D`, in 16px `D` and part of the ellipsis, and in 40px `Dash…`, so only the
 * widest box draws a whole ellipsis after its first character, where a Figma text's ellipsis sits.
 */
describe("a one-line ellipsis the capture measures with room", () => {
  /** Whether the page function records `ellipsisFits` on the span in a box of the width given. */
  async function fits(width: number) {
    await page.setContent(
      `<main data-compare-cell><div id="root" style="font:14px/20px Arial"><span style="display:block;width:${String(width)}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Dashboard</span></div></main>`
    );
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
    const facts = await measuredFacts(cdp, nodeId);
    await cdp.detach();
    return facts.get("0")?.ellipsisFits === true;
  }

  it.each([
    [8, false],
    [16, false],
    [40, true],
  ])("holds in a %ipx box: %s", async (width, held) => {
    expect(await fits(width)).toBe(held);
  });
});

/**
 * Unit under test: the page function's `trackFits` on a one-column grid. Oracle: Chromium's own
 * column, read through `getComputedStyle` beside the fact. A 256px grid whose flex-column item holds
 * a 200px or a 254px box keeps a 256px column with at least a pixel to spare, so the fact holds. One
 * whose item holds a 255.5px box keeps a 256px column with less than a pixel to spare, so it does
 * not, and one whose item holds a 400px box widens its column to 400px, past the grid. The boxes
 * hold no text, so their widths are the same on every platform.
 */
describe("a one-column grid's column the capture measures as fitting", () => {
  /** The grid's column as Chromium resolves it, and whether the page function records `trackFits`. */
  async function measure(inner: number) {
    await page.setContent(
      `<main data-compare-cell><div id="root" style="display:grid;width:256px"><div style="display:flex;flex-direction:column"><div style="width:${String(inner)}px;height:10px"></div></div></div></main>`
    );
    const column = await page.locator("#root").evaluate((grid) => getComputedStyle(grid).gridTemplateColumns);
    const cdp = await page.context().newCDPSession(page);
    const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
    const facts = await measuredFacts(cdp, nodeId);
    await cdp.detach();
    return { column, fits: facts.get("")?.trackFits === true };
  }

  it.each([
    [200, "256px", true],
    [254, "256px", true],
    [255.5, "256px", false],
    [400, "400px", false],
  ])("with a %spx box in its item, a %s column holds it: %s", async (inner, column, fits) => {
    expect(await measure(inner)).toEqual({ column, fits });
  });
});

/**
 * Unit under test: the page function's `ratioHeight` on a 448px `aspect-ratio: 16 / 9` box. Oracle:
 * Chromium's own layout, read beside the fact. Empty, the box is 252px tall, the width times the
 * ratio (CSS Sizing 4 §4.2), so the fact records 448 by 252. A 400px child grows a box with
 * `overflow: visible` to 400px (§4.3), and a `min-height: 300px` raises it to 300px, so the fact does
 * not hold. With `overflow: hidden` the same child leaves the box at 252px, and the fact holds. A box
 * with a height of its own is no candidate, though its height is the ratio's. A 100px flex row
 * shrinks the box to 100px (CSS Flexbox 1 §9.7), and the ratio follows to 56.25px, which the fact
 * records, so the build can tell it from the 448px `width`. A box that a comfortable density widens
 * to 480px, or whose ratio a comfortable density turns to 1 / 1, is 252px tall in the page's own mode
 * and another height there, so the fact does not hold.
 */
describe("an aspect ratio the capture measures as setting the height", () => {
  /** The box's border box as Chromium lays it out, and what the page function records as `ratioHeight`. */
  async function measure(style: string, child: string, className = "", around = "") {
    await page.setContent(
      `<style>[data-density=comfortable] .wide { width: 480px !important } .ratio { --ratio: 16 / 9 } [data-density=comfortable] .ratio { --ratio: 1 / 1 }</style><main data-compare-cell><div style="${around}"><div id="root" class="${className}" style="width:448px;aspect-ratio:16/9;${style}">${child}</div></div></main>`
    );
    const [width, height] = await page
      .locator("#root")
      .evaluate((box) => [box.getBoundingClientRect().width, box.getBoundingClientRect().height]);
    return { width, height, fact: (await factsOfRoot()).facts?.ratioHeight };
  }

  const TALL = '<div style="height:400px"></div>';
  const BOX = { width: 448, height: 252 };

  it.each([
    ["empty", 252, BOX, "", ""],
    ["holding a 400px child", 400, undefined, "", TALL],
    ["holding a 400px child it clips", 252, BOX, "overflow:hidden", TALL],
    ["at a 300px minimum", 300, undefined, "min-height:300px", ""],
    ["with a 252px height of its own", 252, undefined, "height:252px", ""],
  ])("%s, is %spx tall, and the fact records %o", async (_case, height, fact, style, child) => {
    expect(await measure(style, child)).toEqual({ width: 448, height, fact });
  });

  it("records the width a flex row shrinks it to, and the ratio's height there", async () => {
    expect(await measure("", "", "", "display:flex;width:100px")).toEqual({
      width: 100,
      height: 56.25,
      fact: { width: 100, height: 56.25 },
    });
  });

  it.each([
    ["a density moves the width", "", "wide"],
    ["a density changes the ratio", "aspect-ratio:var(--ratio)", "ratio"],
  ])("does not hold where %s", async (_case, style, className) => {
    // The page's own mode stamps no density, so the box is 448 by 252 there.
    expect(await measure(style, "", className)).toEqual({ ...BOX, fact: undefined });
  });
});

/** Measure the root `#root` of the page's markup, and read back its `style` attribute. */
async function factsOfRoot(): Promise<{
  readonly facts: MeasuredFacts | undefined;
  readonly style: string | null;
}> {
  const facts = await factsByPath();
  return { facts: facts.get(""), style: await page.locator("#root").getAttribute("style") };
}

/** Measure the root `#root` of the page's markup: each element's facts, by its path from the root. */
async function factsByPath(): Promise<ReadonlyMap<string, MeasuredFacts>> {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return facts;
}

/**
 * Unit under test: the page function's `underMaxWidth`. Oracle: Chromium's own layout of a box
 * beside its `max-width`, read through `getBoundingClientRect`. A 100px box under `max-width: 100%`
 * of a 300px container keeps 200px of room in every mode, so a maximum 24px lower leaves it 100px
 * wide; under a 110px maximum it keeps 10px, which 24px less takes away; a 400px box under a 300px
 * maximum is narrowed by it already; and a 400px box under `min-content`, which Chromium narrows to
 * its 100px content, takes no `calc()` of it, so nothing proves the maximum idle. A box 200px wide
 * dense and 230px comfortable under a 240px maximum keeps 40px of room dense but 10px comfortable,
 * so the fact fails in a mode the capture does not render. A box 200px wide in the light scheme and
 * 230px in the dark one, under the same maximum, fails it the same way in the dark scheme, which a
 * host can key a length on as well as a color. The page leaves the box's inline style and the
 * document's mode as it found them.
 */
describe("a maximum the capture measures as never narrowing its box", () => {
  async function measure(box: string, inner: string) {
    await page.setContent(
      `<style>:root[data-density="comfortable"] .wider, :root[data-theme="dark"] .darker { width: 230px !important }</style><main data-compare-cell><div style="width:300px"><div id="root" style="${box}"><div class="${inner}" style="width:${inner === "wider" || inner === "darker" ? "200px" : inner};height:10px;flex-shrink:0"></div></div></div></main>`
    );
    const { facts, style } = await factsOfRoot();
    const mode = await page.evaluate(() =>
      ["data-density", "data-theme"].map((name) => document.documentElement.getAttribute(name))
    );
    return { under: facts?.underMaxWidth === true, style, mode };
  }

  it.each([
    ["display:flex;width:fit-content;max-width:100%", "100px", true],
    ["display:flex;width:fit-content;max-width:110px", "100px", false],
    ["display:flex;width:fit-content;max-width:100%", "400px", false],
    ["display:flex;width:400px;max-width:min-content", "100px", false],
    ["display:flex;width:fit-content;max-width:240px", "wider", false],
    ["display:flex;width:fit-content;max-width:240px", "darker", false],
  ])("on %s around a %s child: %s", async (box, inner, under) => {
    expect(await measure(box, inner)).toEqual({ under, style: box, mode: [null, null] });
  });
});

/**
 * Unit under test: the page function's `freeAlongMain`. Oracle: Chromium's own layout of a flex
 * column whose second item takes `margin-top: auto`. A 200px column holding two 40px items 30px apart
 * leaves 90px for the margin. A 100px column leaves none: the items and the gap take 110px, so the
 * margin is 0 and the second item overflows. A column 140px tall dense and 100px tall comfortable
 * leaves 30px dense and none comfortable, so the fact fails in a mode the capture does not render.
 */
describe("a flex line the capture measures as leaving room for an auto margin", () => {
  async function measure(height: string) {
    await page.setContent(
      `<style>:root[data-density="comfortable"] .shrinks { height: 100px !important }</style><main data-compare-cell><div id="root" class="${height === "shrinks" ? "shrinks" : ""}" style="display:flex;flex-direction:column;gap:30px;height:${height === "shrinks" ? "140px" : height}"><div style="height:40px;flex:none"></div><div style="height:40px;flex:none;margin-top:auto"></div></div></main>`
    );
    return (await factsOfRoot()).facts?.freeAlongMain === true;
  }

  it.each([
    ["200px", true],
    ["100px", false],
    ["shrinks", false],
  ])("in a column %s tall: %s", async (height, free) => {
    expect(await measure(height)).toBe(free);
  });
});

/**
 * Unit under test: the page function's `lineFits`. Oracle: Chromium's own layout of a block in a
 * 24px line around one `inline-flex` box at `width: 100%`, a 16px label in its 20px line centred in
 * it, as List detail's `<li>` holds its `w-full` Button, in standards mode, as the capture's page
 * renders, since the quirks mode's line height calculation drops the strut. A 36px box is taller
 * than the strut above and below its baseline, so the block is exactly as tall as the box in every mode, and with its line
 * 2px taller (CSS 2.1 §10.8). A 10px box leaves the strut's 24px line taller than it. A box 36px dense
 * and 10px comfortable fits only dense, so the fact fails in a mode the capture does not render.
 */
describe("a line box the capture measures as adding nothing to its one inline-level child", () => {
  async function measure(height: string) {
    await page.setContent(
      `<!doctype html><style>:root[data-density="comfortable"] .shrinks { height: 10px !important }</style><main data-compare-cell><div id="root" style="font:16px/24px sans-serif;width:200px"><span class="${height === "shrinks" ? "shrinks" : ""}" style="display:inline-flex;align-items:center;width:100%;line-height:20px;height:${height === "shrinks" ? "36px" : height}">Henrik Aasen</span></div></main>`
    );
    return (await factsOfRoot()).facts?.lineFits === true;
  }

  it.each([
    ["36px", true],
    ["10px", false],
    ["shrinks", false],
  ])("around a child %s tall: %s", async (height, fits) => {
    expect(await measure(height)).toBe(fits);
  });
});

/** The bytes of a Roboto face the package's `@fontsource/roboto` ships. */
function roboto(weight: 400 | 500): Buffer {
  return readFileSync(
    new URL(
      `../../node_modules/@fontsource/roboto/files/roboto-latin-${String(weight)}-normal.woff2`,
      import.meta.url
    )
  );
}

/**
 * Unit under test: the page function's sweep through every mode, as a branded mode asks for a face
 * the page has not loaded. Oracle: Chromium's own layout once that face has loaded. A row sets 200
 * `i`s in `Narrow`, Roboto 400 at half its size, in the neutral identity, and in Roboto 500 in the
 * branded one, whose face the page fetches only once a mode asks for it. Until it arrives Chromium
 * sets the row's `Narrow` fallback (`font-display: swap`), so a sweep that measures in the same task
 * as its stamp sees room that is not there. The page measures the text in Roboto 500's bytes under
 * another family name, which loads no Roboto face, and sets the row's container 2px short of that
 * text and the 8px end box. So the maximum binds and the auto margin keeps no room in the branded
 * identity once the face is in, on any platform's text metrics, while `Narrow` leaves half the row
 * free in the neutral identity and before the face arrives.
 */
describe("a fact a mode's late face decides", () => {
  async function measure(): Promise<{
    readonly facts: MeasuredFacts | undefined;
    readonly loaded: { readonly root: number; readonly host: number; readonly margin: string };
  }> {
    await page.route("https://font.invalid/500.woff2", async (route) => {
      await route.fulfill({
        body: roboto(500),
        contentType: "font/woff2",
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    });
    const narrow = `@font-face{font-family:Narrow;font-display:swap;size-adjust:50%;src:url(data:font/woff2;base64,${roboto(400).toString("base64")})}`;
    const probe = `@font-face{font-family:Probe;font-weight:500;src:url(data:font/woff2;base64,${roboto(500).toString("base64")})}`;
    const late =
      "@font-face{font-family:Roboto;font-display:swap;font-weight:500;src:url(https://font.invalid/500.woff2)}";
    await page.setContent(
      `<style>${narrow}${probe}${late}body{font:16px Narrow}[data-theme-identity="branded"] #a{font-family:Roboto,Narrow;font-weight:500}#root{display:flex;width:fit-content;max-width:100%}#a{white-space:nowrap;flex:none;margin-right:auto}#b{width:8px;height:8px;flex:none}</style><main data-compare-cell><div id="host"><div id="root"><div id="a">${"i".repeat(200)}</div><div id="b"></div></div></div></main>`
    );
    await page.evaluate(async () => {
      await Promise.all([document.fonts.load("16px Narrow"), document.fonts.load("500 16px Probe")]);
      const host = document.querySelector<HTMLElement>("#host");
      const text = document.querySelector("#a");
      if (host === null || text === null) throw new Error("the page holds the row");
      const sample = document.createElement("span");
      sample.style.cssText = "font:500 16px Probe;white-space:nowrap;position:absolute;visibility:hidden";
      sample.textContent = text.textContent;
      document.body.append(sample);
      const loadedWidth = sample.getBoundingClientRect().width;
      sample.remove();
      host.style.width = `${String(loadedWidth + 8 - 2)}px`;
    });
    const { facts } = await factsOfRoot();
    await page.unroute("https://font.invalid/500.woff2");
    const loaded = await page.evaluate(async () => {
      document.body.setAttribute("data-theme-identity", "branded");
      await document.fonts.load("500 16px Roboto");
      const root = document.querySelector("#root");
      const text = document.querySelector("#a");
      if (root === null || text === null || root.parentElement === null)
        throw new Error("the page holds the row");
      const reading = {
        root: root.getBoundingClientRect().width,
        host: root.parentElement.getBoundingClientRect().width,
        margin: getComputedStyle(text).marginRight,
      };
      document.body.removeAttribute("data-theme-identity");
      return reading;
    });
    return { facts, loaded };
  }

  it("records neither underMaxWidth nor freeAlongMain where the loaded face takes the room", async () => {
    const { facts, loaded } = await measure();
    // With the branded face in, the row reaches its maximum, its container's width, and the auto
    // margin has no room left.
    expect(loaded.root).toBe(loaded.host);
    expect(loaded.margin).toBe("0px");
    expect({ under: facts?.underMaxWidth === true, free: facts?.freeAlongMain === true }).toEqual({
      under: false,
      free: false,
    });
  });
});

/**
 * Unit under test: the page function's restoration where a measurement throws. Oracle: the page as
 * it was before the call. A root whose `getBoundingClientRect` throws once its maximum is lowered
 * stops the sweep mid-mode; the page still has its own mode and the root its own `style` attribute,
 * and `measuredFacts` rejects rather than return the facts it had so far.
 */
describe("a measurement that throws", () => {
  it("leaves the page's mode and the root's style as they were, and rejects", async () => {
    await page.setContent(
      `<main data-compare-cell><div style="width:300px"><div id="root" style="display:flex;width:100px;max-width:100%"><div style="width:10px;height:10px"></div></div></div></main>`
    );
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-density", "comfortable");
      document.body.setAttribute("data-theme-identity", "branded");
      const root = document.querySelector<HTMLElement>("#root");
      if (root === null) throw new Error("the page holds the root");
      const original = root.getBoundingClientRect.bind(root);
      root.getBoundingClientRect = () => {
        if (root.style.maxWidth.includes("calc(")) throw new Error("injected layout failure");
        return original();
      };
    });
    await expect(factsOfRoot()).rejects.toThrow("injected layout failure");
    expect(
      await page.evaluate(() => ({
        density: document.documentElement.getAttribute("data-density"),
        identity: document.body.getAttribute("data-theme-identity"),
        brand: document.body.getAttribute("data-theme-brand"),
        style: document.querySelector("#root")?.getAttribute("style"),
      }))
    ).toEqual({
      density: "comfortable",
      identity: "branded",
      brand: null,
      style: "display:flex;width:100px;max-width:100%",
    });
  });
});

/**
 * Unit under test: the page function's `tableTiles`. Oracle: Chromium's own table layout (CSS 2.1
 * §17.5). A collapsed table whose two cells each hold a 36px square tiles at every level, and a
 * 200px table's one cell, whose block-level child fills the 200px column, tiles nowhere a child
 * keeps its own size. Where the
 * second cell's square is 60px wide, its column is too, and the first row's cell above it, holding a
 * 36px square, is stretched past it, so that cell records nothing, nor do the row, the body and the
 * table around it. With
 * `border-collapse: separate` and 2px of spacing, the row's cells no longer abut.
 */
describe("a table the capture measures as tiling its parts", () => {
  async function measure(table: string, second: string) {
    await page.setContent(
      `<main data-compare-cell><table id="root" style="${table}"><tbody><tr><td style="padding:0"><div style="width:36px;height:36px"></div></td><td style="padding:0"><div style="width:36px;height:36px"></div></td></tr><tr><td style="padding:0"><div style="width:36px;height:36px"></div></td><td style="padding:0"><div style="width:${second};height:36px"></div></td></tr></tbody></table></main>`
    );
    const facts = await factsByPath();
    const tiles = (path: string) => facts.get(path)?.tableTiles === true;
    return { table: tiles(""), body: tiles("0"), row: tiles("0/0"), cell: tiles("0/0/1") };
  }

  it.each([
    ["border-collapse:collapse", "36px", { table: true, body: true, row: true, cell: true }],
    ["border-collapse:collapse", "60px", { table: false, body: false, row: false, cell: false }],
    [
      "border-collapse:separate;border-spacing:2px",
      "36px",
      { table: false, body: false, row: false, cell: true },
    ],
  ])("in a table %s with a %s square last: %o", async (table, second, expected) => {
    expect(await measure(table, second)).toEqual(expected);
  });

  /**
   * Oracle: Chromium's table layout. A cell that sets a 32px height and no width, as Table's cell
   * does, holds its own one-line text at its max-content width in a table no wider than its content
   * (CSS 2.1 §17.5.2.2), so its first row's cells and the row tile. A collapsed table sets the row's
   * 1px bottom border on the grid line (CSS 2.1 §17.6.2), so the cells span the row's border box. The
   * second row's `x` sits in the column `Order` widens, so its cell is stretched past its text, and
   * the second row, the body and the table record nothing. A 10px height its text outgrows grows the
   * cell, which then holds no length of its own either. Text that may wrap records nothing although
   * it fits on one line here: in a designer's narrower column Chromium wraps it, as `Ready for
   * pickup` in a 60px column grows a 32px cell to 50px, which a fixed height does not follow.
   */
  it.each([
    [
      "border-collapse:collapse",
      "32px",
      "nowrap",
      { row: true, cell: true, stretched: false, body: false, collapses: true },
    ],
    [
      "border-collapse:separate;border-spacing:0",
      "32px",
      "nowrap",
      { row: true, cell: true, stretched: false, body: false, collapses: false },
    ],
    [
      "border-collapse:collapse",
      "10px",
      "nowrap",
      { row: false, cell: false, stretched: false, body: false, collapses: true },
    ],
    [
      "border-collapse:collapse",
      "32px",
      "normal",
      { row: false, cell: false, stretched: false, body: false, collapses: true },
    ],
  ])(
    "in a table %s, a cell of a %s height and %s text that sets no width",
    async (table, height, wrap, expected) => {
      const cell = (text: string) =>
        `<td style="box-sizing:border-box;height:${height};padding:6px 8px;white-space:${wrap};font:14px/14px sans-serif">${text}</td>`;
      // A separated table ignores a row's border (CSS 2.1 §17.6.1), so only the collapsed one sets it.
      const rule = table.includes("collapse:collapse") ? ' style="border-bottom:1px solid black"' : "";
      await page.setContent(
        `<main data-compare-cell><table id="root" style="${table}"><tbody><tr${rule}>${cell("Order")}${cell("Amount")}</tr><tr>${cell("x")}${cell("Amount")}</tr></tbody></table></main>`
      );
      const facts = await factsByPath();
      expect({
        row: facts.get("0/0")?.tableTiles === true,
        cell: facts.get("0/0/0")?.tableTiles === true,
        stretched: facts.get("0/1/0")?.tableTiles === true,
        body: facts.get("0")?.tableTiles === true,
        collapses: facts.get("0/0")?.bordersCollapse === true,
      }).toEqual(expected);
    }
  );

  /**
   * Oracle: CSS 2.1 §17.6.2.1, as Chromium paints it. A collapsed row's 1px border is its own only
   * where no other box on the same grid line sets one: Chromium paints the row's bottom edge in the
   * blue of the next row's 3px `border-top`, paints none under a `1px hidden` one, and in the blue of
   * an equal cell border, which wins over the row's. The row ends its group, and the next row starts
   * a second one, so the first group's `border-bottom` lies on the same edge. The row next to it
   * setting `border-bottom`, as each Table row does, leaves the edge to this row.
   */
  it.each([
    ["", "", "", true],
    ["", "", "border-bottom:1px solid blue", true],
    ["", "", "border-top:3px solid blue", false],
    ["", "", "border-top:1px hidden blue", false],
    ["border-bottom:1px solid blue", "", "", false],
    ["", "border-bottom:1px solid blue", "", false],
  ])(
    "records bordersCollapse on a row's own bottom border with its cell %o, its group %o and the next row %o",
    async (cell, group, next, owns) => {
      await page.setContent(
        `<main data-compare-cell><table id="root" style="border-collapse:collapse"><tbody style="${group}"><tr style="border-bottom:1px solid red"><td style="box-sizing:border-box;padding:0;width:36px;height:36px;${cell}"></td></tr></tbody><tbody><tr style="${next}"><td style="box-sizing:border-box;padding:0;width:36px;height:36px"></td></tr></tbody></table></main>`
      );
      const facts = await factsByPath();
      expect([facts.get("0/0")?.tableTiles, facts.get("0/0")?.bordersCollapse === true]).toEqual([
        true,
        owns,
      ]);
    }
  );

  it("records nothing on a cell whose child fills the column the table stretches, nor on the boxes around it", async () => {
    await page.setContent(
      `<main data-compare-cell><table id="root" style="width:200px;border-collapse:collapse"><tbody><tr><td style="padding:0;vertical-align:top"><div style="display:flex"><div style="width:36px;height:36px"></div></div></td></tr></tbody></table></main>`
    );
    const facts = await factsByPath();
    expect(["", "0", "0/0", "0/0/0"].map((path) => facts.get(path)?.tableTiles === true)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
