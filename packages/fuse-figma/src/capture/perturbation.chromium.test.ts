/**
 * Unit under test: the probe's page function, `probeCells`, as it reads whether a row's last item
 * stops at the room its row leaves it (`capsAtParent`). Oracle: CSS Flexbox 1 §4.1 and §9.7, which
 * Chromium lays out, measured on 2026-11-19 with 16px Arial on 24px lines, around a long text:
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
