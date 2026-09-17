import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { launchSuiteBrowser } from "./demo-page";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

type CellBox = {
  paddingRight: string;
  textAlign: string;
};

async function numericBundleSizeBoxes(page: Page): Promise<{
  measuredHeader: CellBox;
  ceilingHeader: CellBox;
  usedHeader: CellBox;
  measuredBody: CellBox;
}> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${docsBaseUrl()}/handbook/tokens`, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Measured bundle sizes", level: 2 }).scrollIntoViewIfNeeded();

  const table = page.getByRole("table", { name: /min\+gzip/ });
  await table.waitFor();

  return table.evaluate((tableEl) => {
    if (!(tableEl instanceof HTMLTableElement)) {
      throw new Error("expected the measured bundle-size table");
    }
    const headerRow = tableEl.tHead?.rows[0];
    const bodyRow = tableEl.tBodies[0]?.rows[0];
    if (headerRow === undefined || bodyRow === undefined) {
      throw new Error("expected bundle-size header and body rows");
    }
    const headerCells = [...headerRow.cells];
    const read = (el: Element | undefined, label: string): CellBox => {
      if (!(el instanceof HTMLElement)) {
        throw new Error(`missing ${label}`);
      }
      const style = getComputedStyle(el);
      return { paddingRight: style.paddingRight, textAlign: style.textAlign };
    };
    const headerByName = (name: string): Element | undefined =>
      headerCells.find((cell) => cell.textContent.trim() === name);
    const measuredIndex = headerCells.findIndex((cell) => cell.textContent.trim() === "Measured");
    return {
      measuredHeader: read(headerByName("Measured"), "Measured header"),
      ceilingHeader: read(headerByName("Ceiling"), "Ceiling header"),
      usedHeader: read(headerByName("Used"), "Used header"),
      measuredBody: read(bodyRow.cells[measuredIndex], "Measured body cell"),
    };
  });
}

describe("bundle size table numeric cells", () => {
  it("gives numeric headers and body cells zero right padding and right alignment", async () => {
    const page = await browser().newPage();
    const boxes = await numericBundleSizeBoxes(page);
    const numeric = [boxes.measuredHeader, boxes.ceilingHeader, boxes.usedHeader, boxes.measuredBody];

    for (const box of numeric) {
      expect(box).toEqual({ paddingRight: "0px", textAlign: "right" });
    }

    await page.close();
  });
});
