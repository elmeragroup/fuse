/**
 * Unit under test: `measuredFacts`, the capture's page function as it reads the DOM in Chromium, for
 * whether the elements around a root lie exactly behind it (`coincidingAround`). Oracle: Chromium's
 * own pixels, from a screenshot of the page as it renders, and the CSS box model for which elements
 * share the root's box. A 100px root with no paint of its own sits in a 100px red wrapper beside one
 * other child the same size, absolute over it. Where that child draws nothing, the root's center
 * shows the wrapper's red, and the wrapper lies behind the root. A root that fills its own box in
 * blue shows blue there, and the wrapper still lies behind it, since the root's own paint is not
 * over it. So does an open popover inside the root, which paints in the top layer. Where the child
 * draws an SVG, a generated `::after` box or an image, the center shows the child's blue, and so
 * does a generated `::after` box of the wrapper's own, so nothing lies exactly behind the root. The
 * center also shows blue under a box that overflows a zero-size child, and black under a child whose
 * `backdrop-filter` darkens the red. In a blue wrapper, it shows a child's opaque black or red fill.
 *
 * Some paint lies outside the boxes the page reads, or in no box it reads at all. The center shows
 * blue under the wrapper's own full blocks, indented 250px past the root, whose `text-shadow` moves
 * them back over it; under an SVG set 250px to the right whose 600px stroke reaches back; under the
 * wrapper's own list marker, a 100px blue image; under a child whose `content` replaces it with a
 * blue image; and under a child whose open or closed shadow root holds a blue box. Text ink lands
 * where its font puts it, so for text the oracle is any pixel of the root's box that is not red,
 * under an italic `l` scaled 100 times from 10px beside the root, whose slant leans its top back
 * over it.
 *
 * Some effects leave pure colors as they are and change the rest: a `backdrop-filter` of
 * `brightness(2)`, `contrast(200%)` or `saturate(200%)`, and a gray child blended with `overlay`. A
 * wrapper in `rgb(64, 128, 192)` shows them, as a center that is not the wrapper's color. An SVG
 * table on the red channel keeps all three sentinels' bytes, and maps a `#d06834` wrapper's red to
 * 161, a value derived by hand from the table. A clear wrapper shows a child's opaque magenta fill.
 *
 * A rounded corner shows what lies behind it: a pill wrapper's corner shows the page's white, and a
 * blue root's corner that a logical `border-start-start-radius` rounds shows its wrapper's red. A
 * color under two image layers paints within the last layer's `background-clip`, so with `text` the
 * root shows white. A 40% white wrapper over a box with a blue stripe behind its left half shows
 * two colors across the root, derived by hand from the alpha. A page's selector can read the root's
 * style attribute, and its own adopted sheet paints through the measurement and stays the only one
 * after it. A popover's color transition in the root's shadow tree is still running after the
 * measurement.
 */
import { readFileSync } from "node:fs";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { MeasuredFacts } from "./capture-format.ts";
import { measuredFacts } from "./page-facts.ts";
import type { RootRole } from "./page-facts.ts";

const BLUE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==";

const STYLE = `
  body { margin: 0; background: white }
  .wrapper { position: relative; width: 100px; height: 100px; background: red }
  #root { width: 100px; height: 100px }
  .over { position: absolute; inset: 0; width: 100px; height: 100px }
  .generates::after { content: ""; position: absolute; inset: 0; background: blue }
  .shadowed { color: blue; font: 100px/100px sans-serif; white-space: nowrap; text-indent: 250px; text-shadow: -250px 0 blue }
  .shadowed #root { position: absolute; inset: 0 }
  .marked { display: list-item; list-style: inside url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='blue'/%3E%3C/svg%3E") }
  .marked #root { position: absolute; inset: 0 }
  .blue { background: blue }
  .mid { background: rgb(64, 128, 192) }
  .inked #root { background: blue }
  .clipped { background-clip: text }
  .pill { border-radius: 9999px }
  .padded { padding: 4px }
  .ring { position: relative; width: 200px; height: 200px; border-radius: 50% }
  .ring::after { content: ""; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 30px blue }
  .logical #root { border-start-start-radius: 35px; background: blue }
  .clear { background: transparent }
  .tone { background: #d06834 }
  #root:not([style]) + #styled { background: blue }
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

/** The page's top left 101px as Chromium paints the cell's HTML, and how many elements the page function finds behind `#root`. */
async function measure(html: string) {
  await page.setContent(`<style>${STYLE}</style><main data-compare-cell>${html}</main>`);
  // SAFETY: the locator matches `<img>` elements only.
  await page
    .locator("img")
    .evaluateAll((images) => Promise.all(images.map((image) => (image as HTMLImageElement).decode())));
  const shot = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width: 101, height: 101 } }));
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return { shot, coinciding: facts.get("")?.coincidingAround ?? 0 };
}

/** The cell's HTML for a root in a wrapper of the classes given, beside a sibling. */
function wrapped(wrapperClass: string, sibling: string, inRoot = ""): string {
  return `<div class="wrapper ${wrapperClass}"><div id="root">${inRoot}</div>${sibling}</div>`;
}

/** The RGB of a pixel of the shot. */
function pixelAt(shot: PNG, x: number, y: number): readonly number[] {
  const at = (y * shot.width + x) * 4;
  return [...shot.data.subarray(at, at + 3)];
}

/** The root's center pixel as Chromium paints it, and how many elements the page function finds behind the root. */
async function behind(wrapperClass: string, sibling: string, inRoot = "") {
  const { shot, coinciding } = await measure(wrapped(wrapperClass, sibling, inRoot));
  return { pixel: pixelAt(shot, 50, 50), coinciding };
}

/**
 * Whether Chromium paints every pixel of the columns from `from` and the rows given in red, and how many elements
 * the page function finds behind the root. Text whose ink lands somewhere in the box, wherever its
 * font puts it, shows there as a pixel that is not red.
 */
async function allRed(html: string, from: number, columns: number, rows: number) {
  const { shot, coinciding } = await measure(html);
  const red = Array.from({ length: columns * rows }, (_, index) =>
    pixelAt(shot, from + (index % columns), Math.floor(index / columns))
  ).every(([r, g, b]) => r === 255 && g === 0 && b === 0);
  return { red, coinciding };
}

const RED = [255, 0, 0];
const BLUE = [0, 0, 255];
const WHITE = [255, 255, 255];
const MID = [64, 128, 192];

/** A child that hosts a shadow root of the mode given, holding a blue box over the root. */
function shadowHost(mode: string): string {
  return `<div class="over" id="host"></div><script>document.querySelector("#host").attachShadow({ mode: "${mode}" }).innerHTML = '<div style="width:100px;height:100px;background:blue"></div>'; document.currentScript.remove()</script>`;
}

describe("the elements the capture finds lying exactly behind a root", () => {
  it("include a wrapper whose other child draws nothing, so the root shows its red", async () => {
    expect(await behind("", '<div class="over"></div>')).toEqual({ pixel: RED, coinciding: 1 });
  });

  it("include a wrapper under a root that paints blue across its own box, which is the root's own paint", async () => {
    expect(await behind("inked", '<div class="over"></div>')).toEqual({ pixel: BLUE, coinciding: 1 });
  });

  it("include a wrapper under a root whose open popover paints blue over it from the top layer", async () => {
    expect(
      await behind(
        "",
        "",
        '<div popover id="pop" style="inset:0;margin:0;padding:0;border:0;width:100px;height:100px;background:blue"></div><script>document.querySelector("#pop").showPopover(); document.currentScript.remove()</script>'
      )
    ).toEqual({ pixel: BLUE, coinciding: 1 });
  });

  // A positioned box paints over the positioned boxes before it in tree order (CSS 2.1 Appendix E),
  // so the inner wrapper paints over a sibling before it, and the sibling over the outer wrapper.
  it.each([
    ["no sibling", "", RED, 2],
    ["a blue sibling before the inner wrapper", '<div class="over blue"></div>', BLUE, 1],
  ])(
    "count both wrappers of a root in two, up to the outer, with %s",
    async (_, sibling, pixel, coinciding) => {
      const html = `<div class="wrapper">${sibling}<div style="position:relative"><div id="root"></div></div></div>`;
      const { shot, coinciding: found } = await measure(html);
      expect({ pixel: pixelAt(shot, 50, 50), coinciding: found }).toEqual({ pixel, coinciding });
    }
  );

  // The wrapper's 4px padding makes its padding box 108px, around the 100px root.
  it("exclude a padded wrapper, whose padding box is not the root's box", async () => {
    expect(await behind("padded", "")).toEqual({ pixel: RED, coinciding: 0 });
  });

  it("exclude a pill wrapper, whose 9999px radius Chromium draws as a 50px circle that leaves the root's corners white", async () => {
    const { shot, coinciding } = await measure(wrapped("pill", ""));
    expect({ center: pixelAt(shot, 50, 50), corner: pixelAt(shot, 2, 2), coinciding }).toEqual({
      center: RED,
      corner: WHITE,
      coinciding: 0,
    });
  });

  // `border-start-start-radius` is the top left corner in a left-to-right block, so the blue root
  // leaves its wrapper's red there.
  it("exclude a square wrapper under a root rounded by a logical radius, whose corner shows the wrapper", async () => {
    const { shot, coinciding } = await measure(wrapped("logical", ""));
    expect({ center: pixelAt(shot, 50, 50), corner: pixelAt(shot, 1, 1), coinciding }).toEqual({
      center: BLUE,
      corner: RED,
      coinciding: 0,
    });
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
    expect(await behind("shadowed", "████")).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  it("exclude one whose other child's italic letter, scaled from beside the root, leans blue back over it", async () => {
    expect(
      await allRed(
        wrapped(
          "",
          '<span style="position:absolute;right:110px;top:-100px;font:italic 10px/10px sans-serif;color:blue;transform:scale(100);transform-origin:top right">l</span>'
        ),
        0,
        100,
        100
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

  it.each(["open", "closed"])(
    "exclude one whose other child hosts an %s shadow root that paints blue over the root",
    async (mode) => {
      expect(await behind("", shadowHost(mode))).toEqual({ pixel: BLUE, coinciding: 0 });
    }
  );

  it("exclude one whose background is clipped to text it does not hold, so the root shows the page's white", async () => {
    expect(await behind("clipped", "")).toEqual({ pixel: WHITE, coinciding: 0 });
  });

  // The color paints within the last image layer's clip (CSS Backgrounds 3 §3.10), here `text`.
  it("exclude one whose second of two image layers clips its color to text it does not hold, so the root shows white", async () => {
    const { shot, coinciding } = await measure(
      '<div class="wrapper" style="background-image:none,none;background-clip:border-box,text"><div id="root"></div></div>'
    );
    expect({ pixel: pixelAt(shot, 50, 50), coinciding }).toEqual({ pixel: WHITE, coinciding: 0 });
  });

  // The table maps the red channel's 208 / 255 into its fourth segment, from 0.5 to 1:
  // 0.5 + (208 / 255 * 4 - 3) * 0.5 = 0.631, which is 161. Green and blue keep 104 and 52.
  it("exclude one whose other child's backdrop filter maps the wrapper's red channel through a table", async () => {
    const filter =
      '<svg width="0" height="0" style="position:absolute"><filter id="tone" color-interpolation-filters="sRGB"><feComponentTransfer><feFuncR type="table" tableValues="0 .25 .5 .5 1"/></feComponentTransfer></filter></svg>';
    expect(
      await behind("tone", `<div class="over" style="backdrop-filter:url(#tone)"></div>${filter}`)
    ).toEqual({ pixel: [161, 104, 52], coinciding: 0 });
  });

  it("exclude one whose other child paints blue over the root while the root has no style attribute", async () => {
    expect(await behind("", '<div class="over" id="styled"></div>')).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  // The ring's inset shadow follows its round edge, 30px deep, and so paints the root's box at 32px
  // to 42px from its corner. A square ring's shadow would stay within 30px of its edges.
  it("exclude one under a round ancestor whose ::after, rounded by inheritance, shades the root blue", async () => {
    const html =
      '<div class="ring"><div class="wrapper" style="position:absolute;left:32px;top:32px;width:10px;height:10px"><div id="root" style="width:10px;height:10px"></div></div></div>';
    const { shot, coinciding } = await measure(html);
    expect({ pixel: pixelAt(shot, 37, 37), coinciding }).toEqual({ pixel: BLUE, coinciding: 0 });
  });

  // Chromium snaps each edge of the wrapper's paint to the nearest pixel: at x = 0.25 to columns 0
  // to 99, and at x = 0.5 to columns 1 to 100, the pixels it paints for a box at the root's rect. A
  // 1px sibling at the wrapper's left edge snaps to its first column, and one at its right edge to
  // its last.
  const SIBLING = "position:absolute;top:0;width:1px;height:100px;background:blue";
  it.each([
    [0.25, "nothing beside it", "", true, 1],
    [0.25, "a 1px blue sibling at its left edge", `<div style="${SIBLING};left:0"></div>`, false, 0],
    [0.5, "nothing beside it", "", true, 1],
    [0.5, "a 1px blue sibling at its right edge", `<div style="${SIBLING};left:99px"></div>`, false, 0],
  ])("count one at x = %s with %s", async (offset, _, sibling, red, coinciding) => {
    const html = `<div class="wrapper" style="position:absolute;left:${String(offset)}px;top:0"><div id="root"></div>${sibling}</div>`;
    expect(await allRed(html, Math.round(offset), 100, 100)).toEqual({ red, coinciding });
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

  // The clear wrapper has no fill of its own to shoot, and the magenta fill matches the magenta
  // shot, so the green shot tells the fill from the wrapper.
  it("exclude a clear wrapper whose other child fills the root's box in opaque magenta", async () => {
    expect(await behind("clear", '<div class="over" style="background:#ff00ff"></div>')).toEqual({
      pixel: [255, 0, 255],
      coinciding: 0,
    });
  });

  // Over black, 40% white is 0.4 * 255 = 102 in each channel, and over blue its blue channel is
  // 102 + 0.6 * 255 = 255. The stripe behind the left half makes the root's left edge a different
  // color from its right edge. Every shot paints the wrapper opaque, which hides the stripe, so the
  // blur over the root's middle changes nothing in them.
  it("exclude a wrapper with a 40% white fill over a black box with a blue stripe behind half of it", async () => {
    const { shot, coinciding } = await measure(
      '<div style="position:relative;width:100px;height:100px;background:black"><div style="position:absolute;left:0;top:0;width:50px;height:100px;background:blue"></div><div class="wrapper" style="background:rgb(255 255 255 / 0.4)"><div id="root"></div><div class="over" style="inset:20px;width:auto;height:auto;backdrop-filter:blur(3px)"></div></div></div>'
    );
    expect({ left: pixelAt(shot, 5, 50), right: pixelAt(shot, 95, 50), coinciding }).toEqual({
      left: [102, 102, 255],
      right: [102, 102, 102],
      coinciding: 0,
    });
  });

  // The popover's color runs a 100s transition from red to blue. A staged rule's \`transition: none\`
  // would cancel it and leave the popover blue.
  it("leave a running transition in the root's shadow tree running through the measurement", async () => {
    const popover =
      '<script>const pop = document.createElement("div"); pop.popover = "manual"; pop.style.cssText = "color:red;transition:color 100s linear"; pop.textContent = "Pop"; document.querySelector("#root").attachShadow({ mode: "open" }).append(pop); pop.showPopover(); void getComputedStyle(pop).color; pop.style.color = "blue"; document.currentScript.remove()</script>';
    const { coinciding } = await measure(wrapped("", popover));
    expect({
      coinciding,
      transitions: await page.evaluate(() =>
        document
          .querySelector("#root")
          ?.shadowRoot?.firstElementChild?.getAnimations()
          .map((animation) => animation.playState)
      ),
    }).toEqual({ coinciding: 0, transitions: ["running"] });
  });

  it("exclude one whose other child filters the red behind it to black", async () => {
    expect(await behind("", '<div class="over" style="backdrop-filter:brightness(0)"></div>')).toEqual({
      pixel: [0, 0, 0],
      coinciding: 0,
    });
  });

  it.each([
    ["nothing", "", true, 1],
    ["a backdrop-filter of brightness(2)", "backdrop-filter:brightness(2)", false, 0],
    ["a backdrop-filter of contrast(200%)", "backdrop-filter:contrast(200%)", false, 0],
    ["a backdrop-filter of saturate(200%)", "backdrop-filter:saturate(200%)", false, 0],
    ["a gray fill blended with overlay", "mix-blend-mode:overlay;background:rgb(200,200,200)", false, 0],
  ])("count a mid-blue wrapper whose other child has %s", async (_, style, shows, coinciding) => {
    const { pixel, coinciding: found } = await behind("mid", `<div class="over" style="${style}"></div>`);
    expect({ shows: pixel.every((channel, index) => channel === MID[index]), coinciding: found }).toEqual({
      shows,
      coinciding,
    });
  });

  // The inner wrapper paints nothing, so the root shows the outer wrapper's mid blue through it,
  // brightened by the sibling. No candidate's own fill lies across the inner wrapper's shots.
  it("count no wrapper of a root in a clear wrapper inside a mid-blue one, whose other child brightens the blue", async () => {
    const { shot, coinciding } = await measure(
      '<div class="wrapper mid"><div style="position:relative"><div id="root"></div><div class="over" style="backdrop-filter:brightness(2)"></div></div></div>'
    );
    const pixel = pixelAt(shot, 50, 50);
    expect({ shows: pixel.every((channel, index) => channel === MID[index]), coinciding }).toEqual({
      shows: false,
      coinciding: 0,
    });
  });

  // The page adopts a sheet that paints the sibling blue. The measurement adopts its own sheets
  // beside the page's, which keeps painting through the shots, and removes them after.
  it("keep the page's own adopted sheet through the measurement and leave it the only one", async () => {
    const adopt =
      '<script>const sheet = new CSSStyleSheet(); sheet.replaceSync(".over { background: blue }"); document.adoptedStyleSheets = [sheet]; document.currentScript.remove()</script>';
    try {
      const { shot, coinciding } = await measure(wrapped("", `<div class="over"></div>${adopt}`));
      expect({
        pixel: pixelAt(shot, 50, 50),
        coinciding,
        sheets: await page.evaluate("document.adoptedStyleSheets.map((sheet) => sheet.cssRules[0]?.cssText)"),
      }).toEqual({ pixel: BLUE, coinciding: 0, sheets: [".over { background: blue; }"] });
    } finally {
      // Playwright's next \`setContent\` keeps the document's adopted sheets.
      await page.evaluate("document.adoptedStyleSheets = []");
    }
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
 * Unit under test: the page function's `ratio` on a 448px `aspect-ratio: 16 / 9` box. Oracle:
 * Chromium's own layout, read beside the fact. Empty, the box is 252px tall, 448 ÷ (16 / 9)
 * (CSS Sizing 4 §4.2), so the fact records the height set, 448 by 252. A 400px child grows a box with
 * `overflow: visible` to 400px (§4.3), and a `min-height: 300px` raises it to 300px, so the fact does
 * not hold. With `overflow: hidden` the same child leaves the box at 252px, and the fact holds. A box
 * with a height of its own is no candidate, though its height is the ratio's. A 100px flex row
 * shrinks the box to 100px (CSS Flexbox 1 §9.7), and the ratio follows to 56.25px, which the fact
 * records, so the build can tell it from the 448px `width`. A box that a comfortable density widens
 * to 480px, or whose ratio a comfortable density turns to 1 / 1, is 252px tall in the page's own mode
 * and another height there, so the fact does not hold. A box that a comfortable density gives a height
 * of its own, 252px on the 448px box or 24px on a 24px square, keeps the same box there, and a 24px
 * flex basis in a column makes a 24px square as tall as it is wide with an `auto` height; at a 34px
 * width Chromium keeps that one 24px tall, so the ratio does not set the height and the fact does not
 * hold.
 */
describe("an aspect ratio the capture measures as setting the height", () => {
  /** The box's border box as Chromium lays it out, and the box the page function records as the ratio's. */
  async function measure(style: string, child: string, className = "", around = "") {
    await page.setContent(
      `<style>[data-density=comfortable] .wide { width: 480px !important } .ratio { --ratio: 16 / 9 } [data-density=comfortable] .ratio { --ratio: 1 / 1 } [data-density=comfortable] .pinned { height: 252px !important } [data-density=comfortable] .pinned-square { height: 24px !important }</style><main data-compare-cell><div style="${around}"><div id="root" class="${className}" style="width:448px;aspect-ratio:16/9;${style}">${child}</div></div></main>`
    );
    const [width, height] = await page
      .locator("#root")
      .evaluate((box) => [box.getBoundingClientRect().width, box.getBoundingClientRect().height]);
    const ratio = (await factsOfRoot()).facts?.ratio;
    return { width, height, fact: ratio === undefined ? undefined : { ...ratio } };
  }

  const TALL = '<div style="height:400px"></div>';
  const BOX = { width: 448, height: 252 };
  const FACT = { sets: "height", ...BOX };
  const SQUARE = { width: 24, height: 24 };

  it.each([
    ["empty", 252, FACT, "", ""],
    ["holding a 400px child", 400, undefined, "", TALL],
    ["holding a 400px child it clips", 252, FACT, "overflow:hidden", TALL],
    ["at a 300px minimum", 300, undefined, "min-height:300px", ""],
    ["with a 252px height of its own", 252, undefined, "height:252px", ""],
  ])("%s, is %spx tall, and the fact records %o", async (_case, height, fact, style, child) => {
    expect(await measure(style, child)).toEqual({ width: 448, height, fact });
  });

  it("records the width a flex row shrinks it to, and the ratio's height there", async () => {
    expect(await measure("", "", "", "display:flex;width:100px")).toEqual({
      width: 100,
      height: 56.25,
      fact: { sets: "height", width: 100, height: 56.25 },
    });
  });

  it.each([
    ["a density moves the width", "", "wide"],
    ["a density changes the ratio", "aspect-ratio:var(--ratio)", "ratio"],
  ])("does not hold where %s", async (_case, style, className) => {
    // The page's own mode stamps no density, so the box is 448 by 252 there.
    expect(await measure(style, "", className)).toEqual({ ...BOX, fact: undefined });
  });

  it.each([
    ["a density gives it a height of the same 252px", "", "pinned", BOX],
    [
      "a density gives a 24px square a height of the same 24px",
      "width:24px;aspect-ratio:1",
      "pinned-square",
      SQUARE,
    ],
  ])("does not hold where %s", async (_case, style, className, box) => {
    expect(await measure(style, "", className)).toEqual({ ...box, fact: undefined });
  });

  // A flex row that shrinks a wider box straight back leaves its width where it was, so the reading
  // narrows the box instead. In a 24px row, the 14px-wide box stays 24px tall, and in a 100px row the
  // 90px-wide box stays 100px tall: the row stretches its height, so the ratio does not set it.
  it.each([
    ["a 24px flex row", "width:24px;aspect-ratio:1", "display:flex;width:24px;height:24px", SQUARE],
    [
      "a 100px flex row",
      "width:100px;min-width:0;aspect-ratio:1",
      "display:flex;width:100px;height:100px",
      { width: 100, height: 100 },
    ],
  ])("does not hold where %s stretches the height", async (_case, style, around, box) => {
    const square = await measure(style, "", "", around);
    const [wider, narrower] = await page.locator("#root").evaluate((root) => {
      if (!(root instanceof HTMLElement)) {
        return [];
      }
      const read = (width: string) => {
        root.style.setProperty("width", width, "important");
        const { width: across, height: down } = root.getBoundingClientRect();
        return { width: across, height: down };
      };
      const { width } = root.getBoundingClientRect();
      return [read(`${String(width + 10)}px`), read(`${String(width - 10)}px`)];
    });
    expect({ ...square, wider, narrower }).toEqual({
      ...box,
      fact: undefined,
      wider: box,
      narrower: { width: box.width - 10, height: box.height },
    });
  });

  // A square that a 24px flex basis in a column makes as tall as it is wide keeps that height at any
  // width, so the ratio does not set it.
  it("does not hold where a 24px flex basis in a column sets the height", async () => {
    const square = await measure(
      "width:24px;aspect-ratio:1;flex:0 0 24px;overflow:hidden",
      "",
      "",
      "display:flex;flex-direction:column"
    );
    const raised = await page.locator("#root").evaluate((box) => {
      box.style.setProperty("width", "34px", "important");
      return box.getBoundingClientRect().height;
    });
    expect({ ...square, raised }).toEqual({ ...SQUARE, fact: undefined, raised: 24 });
  });
});

/**
 * Unit under test: the page function's `ratio` on a 24px-tall `aspect-ratio: 1` box with an `auto`
 * width. Oracle: Chromium's own layout, read beside the fact. Empty, the box is 24px wide, its height
 * × (1 / 1) (CSS Sizing 4 §4.2), so the fact records the width set, 24 by 24. A 40px-wide child
 * keeps the box 40px wide through its automatic minimum (§5.1), and a `min-width: 30px` widens it to
 * 30px, so the fact does not hold. A box with a width of its own is no candidate, though its width is
 * the ratio's. A block whose height is `auto` too takes its width from its container, and the fact
 * records the height set. A box that a comfortable density makes 30px tall is 24px wide in the page's
 * own mode and another width there, and one that a comfortable density gives a 24px width of its own
 * keeps the same box there, so the fact does not hold. A 24px flex basis, or a stretch across a 24px
 * grid column, makes the box as wide as its height with an `auto` width; at a 34px height Chromium
 * keeps it 24px wide, so the ratio does not set the width and the fact does not hold.
 */
describe("an aspect ratio the capture measures as setting the width", () => {
  /** The box's border box as Chromium lays it out, and the box the page function records as the ratio's. */
  async function measure(style: string, child: string, className = "", around = "") {
    await page.setContent(
      `<style>[data-density=comfortable] .tall { height: 30px !important } [data-density=comfortable] .pinned { width: 24px !important }</style><main data-compare-cell><div style="${around}"><div id="root" class="${className}" style="display:inline-flex;height:24px;aspect-ratio:1;${style}">${child}</div></div></main>`
    );
    const [width, height] = await page
      .locator("#root")
      .evaluate((box) => [box.getBoundingClientRect().width, box.getBoundingClientRect().height]);
    const ratio = (await factsOfRoot()).facts?.ratio;
    return { width, height, fact: ratio === undefined ? undefined : { ...ratio } };
  }

  /** The root's width once its height is raised to 34px, as Chromium lays it out. */
  async function raisedWidth(): Promise<number> {
    return page.locator("#root").evaluate((box) => {
      box.style.setProperty("height", "34px", "important");
      return box.getBoundingClientRect().width;
    });
  }

  const WIDE = '<div style="width:40px;flex-shrink:0"></div>';
  const BOX = { width: 24, height: 24 };

  it.each([
    ["empty", 24, 24, { sets: "width", ...BOX }, "", ""],
    ["holding a 40px-wide child", 40, 24, undefined, "", WIDE],
    ["at a 30px minimum width", 30, 24, undefined, "min-width:30px", ""],
    ["with a 24px width of its own", 24, 24, undefined, "width:24px", ""],
  ])(
    "%s, is %spx wide and %spx tall, and the fact records %o",
    async (_case, width, height, fact, style, child) => {
      expect(await measure(style, child)).toEqual({ width, height, fact });
    }
  );

  // A block whose width and height are both `auto` takes its width from its container and its
  // height from the ratio, so the fact records the height set.
  it("records the height set on a box whose height is auto too", async () => {
    const { width, height, fact } = await measure("display:block;height:auto", "");
    expect({ square: width === height, sets: fact?.sets }).toEqual({ square: true, sets: "height" });
  });

  it.each([
    ["a density moves the height", "tall"],
    ["a density gives it a width of the same 24px", "pinned"],
  ])("does not hold where %s", async (_case, className) => {
    // The page's own mode stamps no density, so the box is 24 by 24 there.
    expect(await measure("", "", className)).toEqual({ ...BOX, fact: undefined });
  });

  // A box that a 24px flex basis or a stretch across a 24px grid column makes as wide as it is tall
  // keeps that width at any height, so the ratio does not set it.
  it.each([
    ["a 24px flex basis", "flex:0 0 24px;overflow:hidden", "display:flex"],
    [
      "a stretch across a 24px grid column",
      "display:block;justify-self:stretch",
      "display:grid;grid-template-columns:24px",
    ],
  ])("does not hold where %s sets the width", async (_case, style, around) => {
    const square = await measure(style, "", "", around);
    expect({ ...square, raised: await raisedWidth() }).toEqual({ ...BOX, fact: undefined, raised: 24 });
  });
});

/** Measure the root `#root` of the page's markup, and read back its `style` attribute. */
async function factsOfRoot(role: RootRole = "root"): Promise<{
  readonly facts: MeasuredFacts | undefined;
  readonly style: string | null;
}> {
  const facts = await factsByPath(role);
  return { facts: facts.get(""), style: await page.locator("#root").getAttribute("style") };
}

/** Measure the root `#root` of the page's markup: each element's facts, by its path from the root. */
async function factsByPath(role: RootRole = "root"): Promise<ReadonlyMap<string, MeasuredFacts>> {
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId, role);
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
 * Unit under test: the page function's `spansHost`, on the anchor of an anchored composite. Oracle:
 * Chromium's layout of a 32px trigger in a host, in every mode, and again in the host 10px wider. A
 * `width: 100%` trigger and a block-level `display: flex` trigger of an auto width are 384px in a
 * 384px host and 394px in the wider one, so the page records 384. A content-box `width: 100%`
 * trigger with 8px side padding is 400px, and one capped at `max-width: 240px` is 240px, so neither
 * spans the host. A `max-width: 384px` trigger is 384px, but stays 384px in the wider host, so its
 * width is the maximum's. In a 384px border-box host with 16px side padding, a `width: 100%;
 * max-width: 100%` trigger is 352px and follows the host, so the page records 352. A host 384px wide
 * dense and 400px comfortable records nothing. A root that is no anchor records nothing either.
 */
describe("an anchor the capture measures as spanning its host", () => {
  async function spans(host: string, trigger: string, role: RootRole = "anchor") {
    await page.setContent(
      `<style>:root[data-density="comfortable"] .moves { width: 400px !important }</style><main data-compare-cell><div class="${host === "moves" ? "moves" : ""}" style="width:384px;${host === "moves" ? "" : host}"><div id="root" style="height:32px;${trigger}"></div></div></main>`
    );
    const { facts, style } = await factsOfRoot(role);
    return { spans: facts?.spansHost, style };
  }

  it.each([
    ["", "display:flex;width:100%", 384],
    ["", "display:flex", 384],
    ["", "display:flex;width:100%;box-sizing:content-box;padding:0 8px", undefined],
    ["", "display:flex;width:100%;max-width:240px", undefined],
    ["", "display:flex;width:100%;max-width:384px", undefined],
    ["box-sizing:border-box;padding:0 16px", "display:flex;width:100%;max-width:100%", 352],
    ["moves", "display:flex;width:100%", undefined],
  ])("in a host of %j, a trigger of %j: %s", async (host, trigger, width) => {
    expect(await spans(host, trigger)).toEqual({ spans: width, style: `height:32px;${trigger}` });
  });

  it("records nothing on a root that is no anchor", async () => {
    expect((await spans("", "display:flex;width:100%", "root")).spans).toBeUndefined();
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
