/**
 * The Chromium behavior `linesOf` in `label-alignment.ts` rests on, which the label mapping's own cases
 * write by hand: the default style sheet gives a `<th>` `text-align: -internal-center`, and under a
 * row at the initial `start` the cell computes `center` and its text sits in the middle of its
 * content box, while under a row that sets any other `text-align` the cell computes the row's
 * value, though the default style sheet's declaration still wins its cascade. Oracle: Chromium's
 * layout of a table header cell built for each case. It goes red where a Chromium release changes
 * either, which the mapping would then draw wrong.
 */
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
});

afterAll(async () => {
  await browser.close();
});

/**
 * Lay out a 100px header cell holding `Sun` in a row whose style is `row`, and read the cell's
 * computed `text-align` and the space its text leaves on its left and right.
 */
async function layOut(row: string) {
  await page.setContent(
    `<!doctype html><style>body { margin: 0; font: 14px/20px sans-serif }</style><table style="border-collapse: collapse"><tr style="${row}"><th style="width: 100px; padding: 0; font-weight: 400">Sun</th></tr></table>`
  );
  return page.evaluate(() => {
    const cell = document.querySelector("th");
    const text = cell?.firstChild;
    if (cell === null || text === null || text === undefined) {
      throw new Error("the page holds no header cell text");
    }
    const range = document.createRange();
    range.selectNodeContents(text);
    const box = cell.getBoundingClientRect();
    const run = range.getBoundingClientRect();
    return {
      align: getComputedStyle(cell).textAlign,
      left: run.left - box.left,
      right: box.right - run.right,
    };
  });
}

describe("a table header cell's -internal-center", () => {
  it.each(["", "text-align: start"])(
    "centers a header cell's text under a row whose style is '%s'",
    async (row) => {
      const { align, left, right } = await layOut(row);
      expect(align).toBe("center");
      // Chromium places the text on its 1/64px layout grid, so the two sides differ by at most one unit.
      expect(Math.abs(left - right)).toBeLessThanOrEqual(1 / 64);
    }
  );

  it.each(["right", "left", "center", "end"])("gives way to a parent's text-align: %s", async (value) => {
    expect((await layOut(`text-align: ${value}`)).align).toBe(value);
  });
});
