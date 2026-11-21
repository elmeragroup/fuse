/**
 * Unit under test: the page function's `inlineRow`, as `measuredFacts` reads the DOM in Chromium,
 * then `fitsAlongMain`, `freeAlongMain`, `oneFlexLine` and `itemsAtContent` in the blocks below.
 * Oracle: CSS's own rules for the markup each case builds, which Chromium lays out.
 *
 * - A flex row blockifies its `display: inline` items (CSS Display 3 §2.7) and, where it neither
 *   wraps nor reverses, sets them on its one line in source order (CSS Flexbox 1 §9.3), so three
 *   one-word spans in a 300px row sit side by side.
 * - A wrapping 60px row breaks the three 40px spans onto lines of their own (§9.3), `row-reverse`
 *   sets them right to left (§5.1), and `order: -1` puts the last one first (§5.4), so none of these
 *   sets its items in source order on one line.
 * - A 30px item holding two six-letter words breaks them onto two lines, so its text leaves one line.
 * - A row 300px wide dense and 60px wide comfortable wraps in a mode the capture does not render.
 * - A row that is a block in the comfortable density lays its spans out inline there, in its line
 *   boxes (CSS 2.1 §9.4.2), and an item that is absolute there leaves the row's flow (CSS Flexbox 1
 *   §4.1), so neither keeps its items as the row's flex items in every mode.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { flexLinesOutcome } from "./capture-format.ts";
import type { FlexLinesFact, MeasuredFacts } from "./capture-format.ts";
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

/** Measure the root `#root` of the markup: each element's facts, by its path from the root. */
async function factsOf(markup: string): Promise<ReadonlyMap<string, MeasuredFacts>> {
  await page.setContent(
    `<style>body{margin:0;font:16px/20px sans-serif} .item{display:inline;flex:none;width:40px} :root[data-density="comfortable"] .narrows{width:60px!important} :root[data-density="comfortable"] .blocks{display:block!important} :root[data-density="comfortable"] .lifts{position:absolute!important} :root[data-density="comfortable"] .widens{width:300px!important} :root[data-density="comfortable"] .wraps{width:120px!important;flex-wrap:wrap!important} :root[data-density="comfortable"] .wraps-wide{flex-wrap:wrap!important} .trails::after{content:"";flex:none;width:260px;height:10px}</style><main data-compare-cell>${markup}</main>`
  );
  const cdp = await page.context().newCDPSession(page);
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#root" });
  const facts = await measuredFacts(cdp, nodeId);
  await cdp.detach();
  return facts;
}

/** The paths of the elements the page records a fact on, in order. */
async function pathsWith(fact: keyof MeasuredFacts, markup: string): Promise<readonly string[]> {
  return [...(await factsOf(markup))].flatMap(([path, facts]) => (facts[fact] === true ? [path] : []));
}

/** A row of three spans with the row's style and class, and the last span's style and text. */
function row(spec: {
  style?: string;
  className?: string;
  last?: string;
  lastClass?: string;
  lastText?: string;
}): string {
  const { style = "", className = "", last = "", lastClass = "", lastText = "c" } = spec;
  return `<div id="root" class="${className}" style="display:flex;width:300px;${style}"><span class="item">a</span><span class="item">b</span><span class="item ${lastClass}" style="${last}">${lastText}</span></div>`;
}

describe("a flex row's inline items the capture measures on one line", () => {
  it("records each item of a row that sets them side by side in source order", async () => {
    expect(await pathsWith("inlineRow", row({}))).toEqual(["0", "1", "2"]);
  });

  it.each([
    ["a wrapping row too narrow for them", row({ style: "flex-wrap:wrap;width:60px" })],
    ["a reversed row", row({ style: "flex-direction:row-reverse" })],
    ["a row whose last item `order` moves first", row({ last: "order:-1" })],
    [
      "a row whose last item breaks its two words onto two lines",
      row({ last: "width:30px", lastText: "cccccc cccccc" }),
    ],
    ["a row that wraps in the comfortable density", row({ style: "flex-wrap:wrap", className: "narrows" })],
    ["a row that is a block in the comfortable density", row({ className: "blocks" })],
    ["a row whose last item is absolute in the comfortable density", row({ lastClass: "lifts" })],
  ])("records nothing in %s", async (_, markup) => {
    expect(await pathsWith("inlineRow", markup)).toEqual([]);
  });
});

/**
 * Unit under test: the page function's `fitsAlongMain` beside `freeAlongMain`, which one sweep
 * measures from the same room. Oracle: Chromium's layout of a row holding a 100px item and a last
 * 40px item with `margin-left: auto`, 8px apart (CSS Flexbox 1 §8.1, §9.7): with the margin at zero
 * the items end at 148px. A 200px row leaves 52px past them, so they fit with 24px free; a 160px row
 * leaves 12px, so they fit with less than 24px free. A 100px row overflows them, and a row 200px wide
 * dense and 60px comfortable fits in one density and overflows in the other, so neither records
 * either fact. The row exactly as wide as its items and gap, 148px, leaves no whole pixel and
 * records neither, and so does a row 200px wide dense that wraps 120px wide comfortable, since its
 * items break onto two lines there (CSS Flexbox 1 §9.3), where the auto margin takes only the room of
 * its own line (§9.5). A row 200px wide in both that wraps only comfortable keeps its items on one
 * line there, so it records both facts. A row that packs its items at its end or spaces them out leaves the same room for
 * the margin, since the margin takes the free space before `justify-content` does, so a 200px row
 * that sets either records both facts and a 160px one only `fitsAlongMain`. The children of a
 * `display: contents` box are the row's items (CSS Display 3 §2.5), so the same margined item inside
 * one leaves the same room: both facts in a 200px row, `fitsAlongMain` in a 160px one and neither in
 * a 100px one. Text after the margined item is an item too (CSS Flexbox 1 §4): a run too long for a
 * 200px row shrinks to the 152px left and wraps there, so the margin takes nothing, though its
 * ragged lines end short of the row, and neither fact holds. Text split by a comment is one run and
 * one item, so `Strawberries Blueberries` after a 40px item shrinks to the 132px a 180px row leaves
 * and wraps, though each of its two text nodes keeps to one line, and neither fact holds; a 400px row
 * keeps the run on one line with room to spare, and records both. A column's text run sits on a line
 * box as tall as its line height (CSS 2.1 §10.8.1), so `Word` at a 100px line height and a 40px item
 * fill a 140px column, the margin takes nothing, and neither fact holds. A `translate` paints a box
 * away from where layout puts it and moves no other box (CSS Transforms 2 §5), so a 148px row whose
 * margined item translates 30px back still leaves the margin nothing, and neither fact holds.
 */
describe("a flex line the capture measures as fitting its items", () => {
  /** Which of the two facts the row of the given width records, its margined item wrapped or not. */
  async function facts(width: string, className = "", justify = "normal", wrapper = "") {
    const margined = `<div style="width:40px;flex:none;margin-left:auto"></div>`;
    const measured = await factsOf(
      `<div id="root" class="${className}" style="display:flex;gap:8px;width:${width};justify-content:${justify}"><div style="width:100px;flex:none"></div>${wrapper === "" ? margined : `<div style="${wrapper}">${margined}</div>`}</div>`
    );
    const root = measured.get("");
    return { fits: root?.fitsAlongMain === true, free: root?.freeAlongMain === true };
  }

  it.each([
    ["200px", "", { fits: true, free: true }],
    ["160px", "", { fits: true, free: false }],
    ["100px", "", { fits: false, free: false }],
    ["148px", "", { fits: false, free: false }],
    ["200px", "narrows", { fits: false, free: false }],
    ["200px", "wraps", { fits: false, free: false }],
    ["200px", "wraps-wide", { fits: true, free: true }],
  ])("in a %s row %s: %o", async (width, className, expected) => {
    expect(await facts(width, className)).toEqual(expected);
  });

  it.each([
    ["200px", { fits: true, free: true }],
    ["160px", { fits: true, free: false }],
    ["100px", { fits: false, free: false }],
  ])("in a %s row whose margined item sits in a display: contents box: %o", async (width, expected) => {
    expect(await facts(width, "", "normal", "display:contents")).toEqual(expected);
  });

  it.each([
    [
      "neither fact where text after the margined item wraps onto ragged lines",
      `<div id="root" style="display:flex;gap:8px;width:200px"><div style="width:40px;flex:none;margin-right:auto"></div>wide words then a few short ones, wrapping onto ragged lines</div>`,
      { fits: false, free: false },
    ],
    [
      "neither fact where a run of text split by a comment wraps onto two lines",
      `<div id="root" style="display:flex;gap:8px;width:180px"><div style="width:40px;flex:none;margin-left:auto"></div>Strawberries <!-- -->Blueberries</div>`,
      { fits: false, free: false },
    ],
    [
      "both facts where a run of text split by a comment keeps to one line",
      `<div id="root" style="display:flex;gap:8px;width:400px"><div style="width:40px;flex:none;margin-right:auto"></div>Strawberries <!-- -->Blueberries</div>`,
      { fits: true, free: true },
    ],
    [
      "neither fact where the margined item's translate moves its painted box off the row's end",
      `<div id="root" style="display:flex;gap:8px;width:148px"><div style="width:100px;flex:none"></div><div style="width:40px;flex:none;margin-left:auto;translate:-30px"></div></div>`,
      { fits: false, free: false },
    ],
    [
      "neither fact in a column whose text sets a line taller than its glyphs",
      `<div id="root" style="display:flex;flex-direction:column;height:140px;font:16px/100px sans-serif"><div style="height:40px;flex:none;margin-top:auto"></div>Word</div>`,
      { fits: false, free: false },
    ],
  ])("records %s", async (_case, markup, expected) => {
    const root = (await factsOf(markup)).get("");
    expect({ fits: root?.fitsAlongMain === true, free: root?.freeAlongMain === true }).toEqual(expected);
  });

  it.each([
    ["200px", "flex-end", { fits: true, free: true }],
    ["200px", "space-between", { fits: true, free: true }],
    ["160px", "flex-end", { fits: true, free: false }],
  ])("in a %s row that sets justify-content: %s: %o", async (width, justify, expected) => {
    expect(await facts(width, "", justify)).toEqual(expected);
  });
});

/**
 * Unit under test: the page function's `itemsAtContent`. Oracle: Chromium's layout of a row of two
 * `flex: 1` items holding one word each, `a` and `bbbbbbbb` (CSS Flexbox 1 §9.7). A `fit-content` row
 * is as wide as their content together, and the wider word's min-content passes its half of that, so
 * each item ends at its own content width. A 300px row shares its free space between them, so each is
 * wider than its word, and a row that is 300px in the comfortable density does so there. Two items
 * holding `cc cc` that may wrap sit at their content in a `fit-content` row, but a narrower share
 * would wrap them rather than keep them at it, so they record nothing either.
 */
describe("a flex row's growing items the capture measures at their content widths", () => {
  /** Whether the row of the given style and class records `itemsAtContent`, around two items of the given text and wrapping. */
  async function atContent(
    style: string,
    className = "",
    items: { readonly a: string; readonly b: string; readonly wrap: string } = {
      a: "a",
      b: "bbbbbbbb",
      wrap: "nowrap",
    }
  ): Promise<boolean> {
    const facts = await factsOf(
      `<div id="root" class="${className}" style="display:flex;${style}"><span style="flex:1;white-space:${items.wrap}">${items.a}</span><span style="flex:1;white-space:${items.wrap}">${items.b}</span></div>`
    );
    return facts.get("")?.itemsAtContent === true;
  }

  it.each([
    ["a fit-content row", "width:fit-content", "", true],
    ["a 300px row", "width:300px", "", false],
    ["a fit-content row 300px wide comfortable", "width:fit-content", "widens", false],
  ])("in %s: %s", async (_, style, className, expected) => {
    expect(await atContent(style, className)).toBe(expected);
  });

  it("records nothing where the items' text can wrap, though each sits at its content", async () => {
    expect(await atContent("width:fit-content", "", { a: "cc cc", b: "cc cc", wrap: "normal" })).toBe(false);
  });
});

/**
 * Unit under test: the page function's `oneFlexLine`, and `freeAlongMain` on a row that wraps.
 * Oracle: CSS Flexbox 1 §9.3 step 1, worked by hand. A wrapping row collects items into a line until
 * the next item's outer size would overflow it, so two 100px items 8px apart fit one line of a 300px
 * row, with 92px to spare, and break onto two lines in a 150px row. Children of a `display: contents`
 * box are the row's items (CSS Display 3 §2.5), so a 250px item inside one breaks the 300px row too,
 * and an absolute 400px child is no item (CSS Flexbox 1 §4.1), so it breaks nothing. Two 146px items
 * fill the 300px row with no pixel to spare, and a row 60px wide in the comfortable density wraps
 * there, so neither keeps the fact in every mode. On the one line, an auto margin takes the 300px
 * row's free space as on a row that does not wrap (§9.5), 300 - 100 - 8 - 40 = 152px. The row's own
 * `::after` and the text of a `display: contents` box are items too (CSS Flexbox 1 §4), so a 260px
 * `::after` after a 40px item, or a run of text after two 40px items, breaks a 240px row onto two
 * lines while every element item keeps its place, and neither records the fact. A nonbreaking space
 * is no document white space, so a run of them is an item: 15 of them after a 50px item break a
 * 120px row, and 32 after a 40px item break a 100px row 20px tall that packs its lines at its start.
 * A run of text split by a comment is one item that fits a 300px row beside a 40px item. In a 120px
 * column, a 20px item and `Word` at a 100px line height fill it with no pixel to spare, so it
 * records nothing. A transform paints a box away from where layout puts it (CSS Transforms 1 §3), so
 * two 100px items fill a 200px row with no gap, and three 60px items a 180px row, whether the last
 * scales to half its size or translates 30px back: the auto margin before it takes nothing, and
 * neither row records either fact.
 */
describe("a wrapping flex row the capture measures on one line", () => {
  /** The facts the root records, around the given children. */
  async function rootFacts(style: string, children: string, className = "") {
    const measured = await factsOf(
      `<div id="root" class="${className}" style="display:flex;flex-wrap:wrap;gap:8px;${style}">${children}</div>`
    );
    const root = measured.get("");
    return { oneLine: root?.oneFlexLine === true, free: root?.freeAlongMain === true };
  }
  const item = (width: number, style = "") =>
    `<div style="width:${String(width)}px;height:10px;flex:none;${style}"></div>`;

  it.each([
    ["two 100px items in a 300px row", "width:300px", item(100) + item(100), ""],
    [
      "an item and one in a display: contents box",
      "width:300px",
      item(100) + `<div style="display:contents">${item(100)}</div>`,
      "",
    ],
    ["an item and a run of text split by a comment", "width:300px", item(40) + "Straw<!-- -->berries", ""],
    [
      "two items beside an absolute child wider than the row",
      "width:300px;position:relative",
      item(100) + item(100) + item(400, "position:absolute"),
      "",
    ],
  ])("records it for %s", async (_case, style, children, className) => {
    expect((await rootFacts(style, children, className)).oneLine).toBe(true);
  });

  it.each([
    ["two 100px items in a 150px row", "width:150px", item(100) + item(100), ""],
    [
      "a 250px item in a display: contents box",
      "width:300px",
      item(100) + `<div style="display:contents">${item(250)}</div>`,
      "",
    ],
    ["two 146px items that fill the row", "width:300px", item(146) + item(146), ""],
    ["a row that is 60px wide in the comfortable density", "width:300px", item(40) + item(40), "narrows"],
    ["a 240px row whose own 260px ::after breaks onto a line of its own", "width:240px", item(40), "trails"],
    [
      "a 120px row whose run of 15 nonbreaking spaces breaks onto a line of its own",
      "width:120px",
      item(50) + "&nbsp;".repeat(15),
      "",
    ],
    [
      "a 100px row 20px tall that packs its lines at its start, whose run of 32 nonbreaking spaces breaks onto a line of its own",
      "width:100px;height:20px;align-items:flex-start",
      item(40, "height:20px") + "&nbsp;".repeat(32),
      "",
    ],
    [
      "a 120px column whose margined item and 100px line of text fill it",
      "flex-direction:column;height:120px;gap:0;line-height:100px",
      item(20, "height:20px;margin-bottom:auto") + "Word",
      "",
    ],
    [
      "a row whose display: contents box ends in text that breaks onto a line of its own",
      "width:240px",
      item(40) +
        `<div style="display:contents">${item(40)}words enough to fill a whole line of their own here</div>`,
      "",
    ],
  ])("records nothing for %s", async (_case, style, children, className) => {
    expect((await rootFacts(style, children, className)).oneLine).toBe(false);
  });

  it.each([
    [
      "a 200px row whose last of two 100px items scales to half its size",
      "width:200px;gap:0",
      item(100) + item(100, "margin-left:auto;transform:scale(.5)"),
    ],
    [
      "a 180px row whose last of three 60px items translates 30px back",
      "width:180px;gap:0",
      item(60) + item(60) + item(60, "margin-left:auto;transform:translateX(-30px)"),
    ],
  ])("records neither fact for %s, which leaves its margin no room", async (_case, style, children) => {
    expect(await rootFacts(style, children)).toEqual({ oneLine: false, free: false });
  });

  it("records the room for an auto margin on the one line", async () => {
    expect(await rootFacts("width:300px", item(100) + item(40, "margin-left:auto"))).toEqual({
      oneLine: true,
      free: true,
    });
  });
});

/**
 * Unit under test: the page function's `flexLines`, as `flexLinesIn` reads each mode and
 * `flexLinesAcross` joins them. Oracle: CSS Flexbox 1 §4, §9.3, §9.4 and §9.7, worked by hand for
 * each row of 80px by 20px items, 10px apart and 4px between lines unless a case says otherwise:
 *
 * - In a 200px row the third item passes 80 + 10 + 80 + 10 + 80 > 200, so it opens a second line,
 *   and the two 20px lines and the 4px gap fill the row's 44px: `fills`, with the items at `x` 0 and
 *   90 on the first line and 0 on the second, 24px down, each 80px wide at `flex: 0 0 auto`. Each
 *   density gives that layout, so the fact keeps it once per density. Items of 20px, 40px and 10px
 *   centred on their lines break the same way, the first line 40px tall.
 * - In a 100px row no two items fit a line, so each stands on one of its own, at `x` 0: three lines
 *   that fill the row, which reading the lines from where each line starts along the row misses.
 * - A row 80px tall leaves 36px over, which `align-content: normal` stretches the lines into, and
 *   two items that `align-self: stretch` with no height of their own fill their lines only through
 *   that stretch: `spare-height` both.
 * - In a 170px row the first line fits two items exactly, and a pixel narrower it breaks before the
 *   second: `tight-break`.
 * - In a 100px row of 30px, 30px and 130px items the 130px one takes a line of its own and shrinks
 *   to the 100px line (§9.7), where with `flex-shrink: 0` it keeps 130px: `shrinks`.
 * - An item with a margin has an outer box the line reading does not take, and the row breaks, so:
 *   `unread`. One 40px item with a margin in a row 80px tall sits on the one line it takes, so the
 *   row records nothing, though forcing `nowrap` moves it: `align-content` packs a wrapping row's one
 *   line at the top, where a row that does not wrap stretches it (§9.4).
 * - A 50px item and a run of 30 nonbreaking spaces, about 120px, in a 100px row: the run lays out in
 *   one anonymous item (§4), which takes the second line: `unread`, which no element's box shows.
 * - A row that widens to 300px in the comfortable density sets its three items on one line there,
 *   and a 200px row that does not wrap in the dense density and wraps at 120px in the comfortable one
 *   breaks a line there only: `some-modes` both.
 * - In a 300px row the items fit one line, and in a 400px row so do items of 20px, 40px and 10px
 *   centred on it: no fact.
 */
describe("a wrapping flex row the capture reads the lines of", () => {
  /** What the root records of its lines, around items of the given styles, `fills` by its name. */
  async function linesOf(
    style: string,
    items: readonly string[],
    className = "",
    after = ""
  ): Promise<FlexLinesFact | undefined> {
    const item = (extra: string) => `<div style="width:80px;height:20px;${extra}"></div>`;
    const measured = await factsOf(
      `<div id="root" class="${className}" style="display:flex;align-items:center;column-gap:10px;row-gap:4px;${style}">${items.map(item).join("")}${after}</div>`
    );
    return measured.get("")?.flexLines;
  }
  const named = (fact: FlexLinesFact | undefined) => {
    const outcome = fact === undefined ? undefined : flexLinesOutcome(fact);
    return outcome?._tag === "Fills" ? "fills" : outcome?.refusal;
  };

  it("reads lines that fill the row, and names what keeps any other row of lines from Figma's WRAP", async () => {
    const plain = ["", "", ""];
    // One page measures each row in turn.
    const recorded: (FlexLinesFact | undefined)[] = [];
    for (const [style, items, className, after] of [
      ["flex-wrap:wrap;width:200px", plain, "", ""],
      ["flex-wrap:wrap;width:200px", ["", "height:40px", "height:10px"], "", ""],
      ["flex-wrap:wrap;width:100px", plain, "", ""],
      ["flex-wrap:wrap;width:200px;height:80px", plain, "", ""],
      [
        "flex-wrap:wrap;width:200px;height:80px",
        ["height:auto;align-self:stretch", "", "height:auto;align-self:stretch"],
        "",
        "",
      ],
      ["flex-wrap:wrap;width:170px", plain, "", ""],
      ["flex-wrap:wrap;width:100px", ["width:30px", "width:30px", "width:130px"], "", ""],
      ["flex-wrap:wrap;width:200px", ["margin-left:4px", "", ""], "", ""],
      [
        "flex-wrap:wrap;width:200px;height:80px;align-content:flex-start",
        ["width:40px;margin-left:4px"],
        "",
        "",
      ],
      [
        "flex-wrap:wrap;width:100px;height:50px;align-items:flex-start;align-content:flex-start;font:16px/20px sans-serif",
        ["width:50px;flex:none"],
        "",
        "&nbsp;".repeat(30),
      ],
      ["flex-wrap:wrap;width:200px", plain, "widens", ""],
      ["width:200px", plain, "wraps", ""],
      ["flex-wrap:wrap;width:300px", plain, "", ""],
      ["flex-wrap:wrap;width:400px", ["", "height:40px", "height:10px"], "", ""],
    ] as const) {
      recorded.push(await linesOf(style, items, className, after));
    }
    expect(recorded.map(named)).toEqual([
      "fills",
      "fills",
      "fills",
      "spare-height",
      "spare-height",
      "tight-break",
      "shrinks",
      "unread",
      undefined,
      "unread",
      "some-modes",
      "some-modes",
      undefined,
      undefined,
    ]);
    const layout = {
      width: 200,
      items: [0, 90, 0].map((x, index) => ({ x, y: index === 2 ? 24 : 0, width: 80, height: 20, own: 80 })),
    };
    const first = recorded[0];
    const outcome = first === undefined ? undefined : flexLinesOutcome(first);
    expect(
      outcome?._tag === "Fills"
        ? outcome.layouts.map(({ mode, ...kept }) => [mode.includes(kept.density), kept])
        : outcome
    ).toEqual([
      [true, { density: "dense", ...layout }],
      [true, { density: "comfortable", ...layout }],
    ]);
  });
});
