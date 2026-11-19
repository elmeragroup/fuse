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
 * so the fact fails in a mode the capture does not render. The page leaves the box's inline style and
 * the document's mode as it found them.
 */
describe("a maximum the capture measures as never narrowing its box", () => {
  async function measure(box: string, inner: string) {
    await page.setContent(
      `<style>:root[data-density="comfortable"] .wider { width: 230px !important }</style><main data-compare-cell><div style="width:300px"><div id="root" style="${box}"><div class="${inner}" style="width:${inner === "wider" ? "200px" : inner};height:10px;flex-shrink:0"></div></div></div></main>`
    );
    const { facts, style } = await factsOfRoot();
    const density = await page.evaluate(() => document.documentElement.getAttribute("data-density"));
    return { under: facts?.underMaxWidth === true, style, density };
  }

  it.each([
    ["display:flex;width:fit-content;max-width:100%", "100px", true],
    ["display:flex;width:fit-content;max-width:110px", "100px", false],
    ["display:flex;width:fit-content;max-width:100%", "400px", false],
    ["display:flex;width:400px;max-width:min-content", "100px", false],
    ["display:flex;width:fit-content;max-width:240px", "wider", false],
  ])("on %s around a %s child: %s", async (box, inner, under) => {
    expect(await measure(box, inner)).toEqual({ under, style: box, density: null });
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
