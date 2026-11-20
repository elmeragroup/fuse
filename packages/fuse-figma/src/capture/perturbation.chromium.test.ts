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
