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

/** Wide enough for Prop · Type · Default (52rem = 832px). */
const DESKTOP = { width: 1280, height: 720 } as const;

/** Below 34rem (544px): Prop only. */
const NARROW = { width: 500, height: 720 } as const;

/** 34rem through 51.999rem: Prop + Type. */
const MID = { width: 600, height: 720 } as const;

type HeaderVisibility = {
  prop: boolean;
  type: boolean;
  defaultCell: boolean;
};

async function openScrollAreaApi(page: Page): Promise<void> {
  await page.setViewportSize(DESKTOP);
  await page.goto(`${docsBaseUrl()}/components/scroll-area`, { waitUntil: "load" });
  await page.locator("h1").first().waitFor();
}

async function headerCellVisibility(page: Page): Promise<HeaderVisibility> {
  await page.getByRole("heading", { name: "API reference" }).scrollIntoViewIfNeeded();
  return page.evaluate(() => {
    const section = document.getElementById("api-reference")?.closest("section");
    const group = [...(section?.querySelectorAll('[role="group"]') ?? [])].find((el) =>
      (el.getAttribute("aria-label") ?? "").includes("props: name, type, default")
    );
    const header = group?.querySelector(":scope > [aria-hidden]");
    if (!(header instanceof HTMLElement)) {
      throw new Error("expected API header row");
    }
    const isShown = (label: string): boolean => {
      const el = [...header.querySelectorAll(":scope > span")].find((span) => span.textContent === label);
      if (el === undefined) {
        throw new Error(`missing ${label} header cell`);
      }
      return getComputedStyle(el).display !== "none";
    };
    return {
      prop: isShown("Prop"),
      type: isShown("Type"),
      defaultCell: isShown("Default"),
    };
  });
}

describe("API panel layout (docs-site.md §8)", () => {
  it("shows the entire persisted country union in the expanded phone reference", async () => {
    const page = await browser.newPage();
    try {
      await page.goto(`${docsBaseUrl()}/components/phone-number-field`, { waitUntil: "load" });
      const summary = page.locator('summary[aria-label*="Prop: defaultCountryCode,"]');
      await summary.click();
      const signature = await summary.locator("..").locator("pre").textContent();
      expect(signature?.length).toBeGreaterThan(1000);
      expect(signature).not.toMatch(/\.\.\. \d+ more \.\.\./);
      expect(signature).toContain('"NO"');
      expect(signature).toContain('"SE"');
      expect(signature).toContain('"ZW"');
    } finally {
      await page.close();
    }
  });

  it("shows Prop, Type, and Default header cells according to viewport width", async () => {
    const page = await browser.newPage();
    await openScrollAreaApi(page);

    await page.setViewportSize(NARROW);
    expect(await headerCellVisibility(page)).toEqual({
      prop: true,
      type: false,
      defaultCell: false,
    });

    await page.setViewportSize(MID);
    expect(await headerCellVisibility(page)).toEqual({
      prop: true,
      type: true,
      defaultCell: false,
    });

    await page.setViewportSize(DESKTOP);
    expect(await headerCellVisibility(page)).toEqual({
      prop: true,
      type: true,
      defaultCell: true,
    });

    await page.close();
  });

  it("lets an expanded panel span the table instead of shrinking to the Prop column", async () => {
    const page = await browser.newPage();
    await openScrollAreaApi(page);

    // Native <summary> is not exposed as role=button here, and content-visibility:auto
    // keeps offscreen rows out of the a11y tree until they are near the viewport.
    await page.getByRole("heading", { name: "API reference" }).scrollIntoViewIfNeeded();
    const trigger = page.locator("summary[aria-label*='Prop: type, type: ScrollAreaType']").first();
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
