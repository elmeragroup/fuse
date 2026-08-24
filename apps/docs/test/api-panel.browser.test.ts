import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

/** Wide enough for Prop · Type · Default (ApiReference.css 52rem breakpoint). */
const DESKTOP = { width: 1280, height: 720 } as const;

async function openScrollAreaApi(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(`${docsBaseUrl()}/components/scroll-area`, { waitUntil: "load" });
  await page.locator("h1").first().waitFor();
}

describe("API panel layout (docs-site.md §8)", () => {
  it("lets an expanded panel span the table instead of shrinking to the Prop column", async () => {
    const page = await browser.newPage();
    await openScrollAreaApi(page);

    const trigger = page.getByRole("button", { name: /Prop: type, type: ScrollAreaType/ }).first();
    await trigger.click();

    const widths = await trigger.evaluate((el) => {
      const row = el.closest("details");
      const panel = row?.querySelector("dl")?.parentElement;
      if (!(row instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
        throw new Error("expected an expanded API row and its panel");
      }
      return {
        row: row.getBoundingClientRect().width,
        panel: panel.getBoundingClientRect().width,
      };
    });

    // Pre-fix: ::details-content auto-placed into column 1 (~0.29 of the row).
    expect(widths.panel / widths.row).toBeGreaterThan(0.9);
    expect(Math.abs(widths.panel - widths.row)).toBeLessThan(4);

    await page.close();
  });
});
