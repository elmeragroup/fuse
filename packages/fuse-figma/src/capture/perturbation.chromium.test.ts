/**
 * Unit under test: the probe's page function, `probeCells`, as it reads whether a row's last item
 * stops at the room its row leaves it (`capsAtParent`), and, below, whether a box is a table cell. Oracle:
 * CSS Flexbox 1 §4.1 and §9.7, which Chromium lays out, measured on 2026-11-19 with 16px Arial on
 * 24px lines, around a long text:
 * - Beside a 24px control that keeps its width and a 12px gap, a 300px row's last item wraps at
 *   264px, the room the row leaves.
 * - Where the control can shrink to a 16px minimum, Chromium shrinks it to 16px and sets the item at
 *   272px, past that room.
 * - In a `max-content` row the row widens with the item, to 4555.4px on one line, so no room caps it.
 * - An absolute item with a `max-width: 100%` is out of the flow, so it wraps at 300px, the row's
 *   whole content box, beside the same control.
 *
 * It also holds the probe's wait for Base UI's `--anchor-width` to the property's syntax: Base UI
 * writes the anchor's width in pixels on the positioner of the popup that names `data-side`, a frame
 * or more after the anchor resizes. A positioner whose property becomes the 200px anchor's width 30
 * frames after the page loads settles, so the popup reads 200px before the wider run and in it. One
 * whose property is `auto`, or that carries none, never settles, and the probe stops naming the
 * cell. Where the property never follows an anchor that fills its widened host, the wider run stops
 * the same way, and the host's style is the one the page set.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { probeCells } from "./perturbation.ts";
import { inferKind } from "./probe-sizing.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 800, height: 400 } });
});

afterAll(async () => {
  await browser.close();
});

/**
 * Probe a row of a 24px control and an item of text, and say whether the item caps at its room.
 *
 * @param styles - The row's, the control's and the item's inline styles.
 */
async function itemCaps(styles: {
  readonly row?: string;
  readonly control: string;
  readonly item?: string;
}): Promise<boolean | undefined> {
  await page.setContent(
    `<style>body{margin:0;font:16px/24px Arial}</style><div data-compare-cell="c0"><div style="width:300px"><div data-slot="row" style="display:flex;gap:12px;${styles.row ?? "width:300px"}"><div data-slot="control" style="width:24px;height:24px;${styles.control}"></div><div data-slot="item" style="${styles.item ?? ""}">Covers theft.</div></div></div></div>`
  );
  const [cell] = await probeCells(page, [{ id: "c0", measured: ['[data-slot="row"]'] }]);
  return cell?.boxes.find((box) => box.slot === "item")?.capsAtParent;
}

describe("the room the probe reads beside a row's last item", () => {
  it("caps the item at the room a control that keeps its width leaves", async () => {
    expect(await itemCaps({ control: "flex-shrink:0" })).toBe(true);
  });

  it("does not cap the item where the control shrinks and the item passes that room", async () => {
    expect(await itemCaps({ control: "min-width:16px" })).toBe(false);
  });

  it("does not cap the item where the row widens with it", async () => {
    expect(await itemCaps({ row: "width:max-content", control: "flex-shrink:0" })).toBe(false);
  });

  it("caps an absolute item at the row's whole content box", async () => {
    expect(
      await itemCaps({
        row: "width:300px;position:relative",
        control: "flex-shrink:0",
        item: "position:absolute;left:0;top:24px;max-width:100%",
      })
    ).toBe(true);
  });
});

// Unit under test: what the probe reads of a table cell (`tableCell`). Oracle: CSS 2.1 §17.5.2.2,
// under which a cell's set width is its minimum, so text longer than the cell widens it, as
// Chromium laid out a `th` at `width: 36px` holding "Mo" on 2026-11-20 with 16px Arial: 36px as
// rendered and wider with its text longer. The rule that agrees such a cell with a layer fixed at
// its rendered width rests on that; the table around it is no cell.
describe("a table cell", () => {
  it("reads as a cell its longer text widens past its set width, and its table as no cell", async () => {
    await page.setContent(
      '<style>body{margin:0;font:16px/24px Arial}th{padding:0}</style><div data-compare-cell="c0"><div style="width:600px"><table data-slot="table" style="border-collapse:collapse"><tr><th data-slot="cell" style="width:36px">Mo</th><th>Tu</th></tr></table></div></div>'
    );
    const [probed] = await probeCells(page, [{ id: "c0", measured: ['[data-slot="table"]'] }]);
    const cell = probed?.boxes.find((each) => each.slot === "cell");
    const table = probed?.boxes.find((each) => each.slot === "table");
    expect({
      cell: cell?.tableCell,
      rendered: Math.round(cell?.base ?? 0),
      longerWidens: (cell?.longer ?? 0) > 37,
      table: table?.tableCell,
    }).toEqual({ cell: true, rendered: 36, longerWidens: true, table: false });
  });
});

// Unit under test: what the probe reads and infers of a box whose text sits at a `min-width`.
// Oracle: CSS Sizing 3 §5.2, under which an auto width held at a minimum keeps that minimum until
// its content passes it, as Chromium laid these out on 2026-11-20 with 16px Arial: an inline-flex
// box around a 300px-minimum text and a 20px sibling measures 320px rendered and with its text
// longer, and wider with it far longer in a 20000px root, which leaves it room, and an inline-block
// at `min-width: 300px` in a 600px root measures 300px, 300px and the root's 600px. The text
// reaches each box once it passes the minimum.
describe("a box whose text sits at a min-width", () => {
  /** Probe a box inside a root of a width, and read the box as measured and inferred. */
  const probed = async (box: string, rootWidth: number) => {
    await page.setContent(
      `<style>body{margin:0;font:16px/24px Arial}</style><div data-compare-cell="c0"><div data-slot="root" style="width:${String(rootWidth)}px">${box}</div></div>`
    );
    const [cell] = await probeCells(page, [{ id: "c0", measured: ['[data-slot="root"]'] }]);
    const measured = cell?.boxes.find((each) => each.slot === "box");
    return (
      measured && {
        kept: [measured.base, measured.longer].map(Math.round),
        farLongerWidens: measured.longest - measured.base > 1,
        inferred: inferKind(measured),
      }
    );
  };

  it("reads an inline-flex box its far longer text widened as hugging its text", async () => {
    expect(
      await probed(
        '<div data-slot="box" style="display:inline-flex"><span style="min-width:300px">Mo</span><span style="width:20px"></span></div>',
        20000
      )
    ).toEqual({ kept: [320, 320], farLongerWidens: true, inferred: "hug" });
  });

  it("reads an inline-block its far longer text widened to its parent as fitting its text", async () => {
    expect(
      await probed('<div data-slot="box" style="display:inline-block;min-width:300px">Mo</div>', 600)
    ).toEqual({ kept: [300, 300], farLongerWidens: true, inferred: "fits" });
  });
});

// Unit under test: the place `probeCells` gives each box. Oracle: the capture's naming of places,
// the root's index among the cell's measured roots, `root`, and the element child index at each step
// down, applied by hand to this markup, where an element without a `data-slot` still counts as a
// child.
describe("the place of each box", () => {
  it("names each box by its root's index and the element child index at each step down", async () => {
    await page.setContent(
      `<div data-compare-cell="c0"><div data-slot="popup"><span></span><div data-slot="list"><i></i><b data-slot="item">Apple</b></div></div><div data-slot="anchor">Open</div></div>`
    );
    const [cell] = await probeCells(page, [
      { id: "c0", measured: ['[data-slot="popup"]', '[data-slot="anchor"]'] },
    ]);
    expect(cell?.boxes.map(({ slot, place }) => `${slot} ${place}`)).toEqual([
      "popup 0/root",
      "list 0/root/1",
      "item 0/root/1/1",
      "anchor 1/root",
    ]);
  });
});

describe("the probe's wait for a popup to take its anchor's width", () => {
  /**
   * Probe an anchor in a 200px host and a popup below it whose absolute positioner carries `style`,
   * as Base UI's positioner holds the popup that names `data-side`. Where `delay` is a number, the page sets
   * the positioner's `--anchor-width` to the anchor's width in pixels once, that many frames after it
   * loads, as Base UI writes it a frame or more after its anchor resizes.
   */
  const probeAnchored = async (options: {
    readonly anchor: string;
    readonly style: string;
    readonly delay?: number;
  }) => {
    const late =
      options.delay === undefined
        ? ""
        : `<script>(() => { let frame = 0; const tick = () => { frame += 1; if (frame < ${String(options.delay)}) { requestAnimationFrame(tick); return; } document.querySelector("#positioner").style.setProperty("--anchor-width", document.querySelector('[data-slot="anchor"]').getBoundingClientRect().width + "px"); }; requestAnimationFrame(tick); })();</script>`;
    await page.setContent(
      `<div data-compare-cell="c0"><div id="host" style="width:200px"><div data-slot="anchor" style="${options.anchor};height:24px"></div></div><div id="positioner" style="position:absolute;${options.style}"><div data-slot="popup" data-side="bottom" style="width:var(--anchor-width);height:24px"></div></div></div>${late}`
    );
    return probeCells(page, [{ id: "c0", measured: ['[data-slot="anchor"]', '[data-slot="popup"]'] }]);
  };

  it("reads the page before and in the wider run once the positioner's --anchor-width is set late", async () => {
    const [cell] = await probeAnchored({ anchor: "width:200px", style: "", delay: 30 });
    const popup = cell?.boxes.find((box) => box.slot === "popup");
    expect([popup?.base, popup?.wider]).toEqual([200, 200]);
  });

  it.each([
    ["auto", "--anchor-width:auto"],
    ["absent", ""],
  ])("stops naming the cell where --anchor-width is %s", async (_name, style) => {
    await expect(probeAnchored({ anchor: "width:200px", style })).rejects.toThrow(
      "Base UI never set --anchor-width to the anchor's width in c0"
    );
  });

  it("puts the widened host back where the wider run stops", async () => {
    // The anchor fills its host, which the wider run widens, and the property stays the 200px the
    // page set, so the run stops there.
    await expect(probeAnchored({ anchor: "width:100%", style: "--anchor-width:200px" })).rejects.toThrow(
      "Base UI never set --anchor-width to the anchor's width in c0"
    );
    expect(await page.locator("#host").getAttribute("style")).toBe("width:200px");
  });
});
