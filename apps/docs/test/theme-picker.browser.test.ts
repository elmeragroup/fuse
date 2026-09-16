import { chromium } from "playwright";
import type { Browser, Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

async function openSettings(page: Page): Promise<Locator> {
  await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Theme settings", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Theme settings", exact: true });
  await menu.waitFor();
  return menu;
}

function choice(menu: Locator, name: string): Locator {
  return menu.getByRole("menuitemradio", { name, exact: true });
}

async function expectPreview(page: Page, variant: string, brand: string, segment: string): Promise<void> {
  // DOM audit: the preview stage and document own distinct theme attribute triples.
  await expect
    .poll(() =>
      page
        .locator("[data-demo-stage]")
        .first()
        .evaluate((stage) => ({
          variant: stage.getAttribute("data-theme-variant"),
          brand: stage.getAttribute("data-theme-brand"),
          segment: stage.getAttribute("data-theme-segment"),
        }))
    )
    .toEqual({ variant, brand, segment });
  await expect
    .poll(() =>
      page.locator("html").evaluate((root) => ({
        variant: root.getAttribute("data-theme-variant"),
        brand: root.getAttribute("data-theme-brand"),
        segment: root.getAttribute("data-theme-segment"),
        density: root.getAttribute("data-density"),
      }))
    )
    .toEqual({ variant: "internal", brand: "elma", segment: "private", density: "dense" });
}

async function expectFocused(locator: Locator): Promise<void> {
  await expect.poll(() => locator.evaluate((element) => element === document.activeElement)).toBe(true);
}

describe("docs theme settings", () => {
  it("labels each group and changes previews while the menu keeps the document theme", async () => {
    const page = await browser.newPage({ colorScheme: "light" });
    const menu = await openSettings(page);
    for (const name of ["Appearance", "Variant", "Brand", "Segment"]) {
      expect(await menu.getByRole("group", { name, exact: true }).count()).toBe(1);
    }
    await expectPreview(page, "internal", "fkas", "private");
    const initialPaint = await menu.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      font: getComputedStyle(element).fontFamily,
      brand: getComputedStyle(element).getPropertyValue("--brand"),
      height: getComputedStyle(element).getPropertyValue("--control-h-sm"),
    }));
    await choice(menu, "External").click();
    await choice(menu, "TrøndelagKraft").click();
    await choice(menu, "Company").click();
    await expectPreview(page, "external", "tkas", "company");
    expect(await menu.isVisible()).toBe(true);
    await expectFocused(choice(menu, "Company"));
    expect(
      await menu.evaluate((element) => ({
        background: getComputedStyle(element).backgroundColor,
        font: getComputedStyle(element).fontFamily,
        brand: getComputedStyle(element).getPropertyValue("--brand"),
        height: getComputedStyle(element).getPropertyValue("--control-h-sm"),
      }))
    ).toEqual(initialPaint);
    await page.keyboard.press("Escape");
    await expect.poll(() => menu.count()).toBe(0);
    await page.close();
  });

  it("coerces pinned brands, disables the unavailable segment, and resets only the preview", async () => {
    const page = await browser.newPage({ colorScheme: "light" });
    const menu = await openSettings(page);
    await choice(menu, "Dark").click();
    await choice(menu, "External").click();
    await choice(menu, "Fjordkraft Företag").click();
    await expectPreview(page, "external", "fkab", "company");
    expect(await choice(menu, "Private").getAttribute("aria-disabled")).toBe("true");
    expect(await choice(menu, "Company").getAttribute("aria-checked")).toBe("true");
    expect(await menu.getByText("This brand supports Company only.", { exact: false }).count()).toBe(1);
    await choice(menu, "Private").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expectPreview(page, "external", "fkab", "company");
    await choice(menu, "Telinet").click();
    await expectPreview(page, "external", "fkse", "private");
    expect(await choice(menu, "Company").getAttribute("aria-disabled")).toBe("true");
    await choice(menu, "Fjordkraft").click();
    expect(await choice(menu, "Company").getAttribute("aria-disabled")).not.toBe("true");
    await choice(menu, "Company").click();
    await menu.getByRole("menuitem", { name: "Reset preview theme", exact: true }).click();
    await expectPreview(page, "internal", "fkas", "private");
    expect(await menu.isVisible()).toBe(true);
    expect(await choice(menu, "Dark").getAttribute("aria-checked")).toBe("true");
    expect(await page.locator("html").getAttribute("data-theme")).toBe("dark");
    await page.close();
  });

  it("supports keyboard selection, Escape focus return, and outside dismissal", async () => {
    const page = await browser.newPage({ colorScheme: "light" });
    await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: "Theme settings", exact: true });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: "Theme settings", exact: true });
    await menu.waitFor();
    await expectFocused(choice(menu, "Light"));
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expectFocused(choice(menu, "Dark"));
    expect(await choice(menu, "Dark").getAttribute("aria-checked")).toBe("true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expectFocused(choice(menu, "System"));
    expect(await choice(menu, "System").getAttribute("aria-checked")).toBe("true");
    await page.keyboard.press("Escape");
    await expect.poll(() => menu.count()).toBe(0);
    await expectFocused(trigger);
    await trigger.click();
    await menu.waitFor();
    const heading = await page.getByRole("heading", { name: "Button", exact: true, level: 1 }).boundingBox();
    if (heading === null) throw new Error("expected the page heading outside the menu");
    // A real outside click hits the menu's backdrop; a locator click waits for it to stop intercepting.
    await page.mouse.click(heading.x + heading.width / 2, heading.y + heading.height / 2);
    await expect.poll(() => menu.count()).toBe(0);
    await page.close();
  });

  it("persists appearance and keeps System selected as the device scheme changes", async () => {
    const page = await browser.newPage({ colorScheme: "light" });
    let menu = await openSettings(page);
    expect(await choice(menu, "System").getAttribute("aria-checked")).toBe("true");
    const lightPaint = await menu.evaluate((element) => getComputedStyle(element).backgroundColor);
    await choice(menu, "Dark").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
    expect(await menu.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightPaint);
    expect(await page.evaluate(() => localStorage.getItem("elmera-color-scheme"))).toBe("dark");
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Theme settings", exact: true }).click();
    menu = page.getByRole("menu", { name: "Theme settings", exact: true });
    await menu.waitFor();
    expect(await choice(menu, "Dark").getAttribute("aria-checked")).toBe("true");
    await choice(menu, "System").click();
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("light");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe("dark");
    expect(await choice(menu, "System").getAttribute("aria-checked")).toBe("true");
    await choice(menu, "Light").click();
    expect(await page.locator("html").getAttribute("data-theme")).toBe("light");
    await page.close();
  });

  it("fits a narrow, short viewport and scrolls to the reset action with the keyboard", async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 480 }, colorScheme: "dark" });
    const menu = await openSettings(page);
    const box = await menu.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) throw new Error("expected a visible menu");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(box.y + box.height).toBeLessThanOrEqual(480);
    expect(await menu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await page.keyboard.press("End");
    const reset = menu.getByRole("menuitem", { name: "Reset preview theme", exact: true });
    await expectFocused(reset);
    expect(await menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    const resetBox = await reset.boundingBox();
    expect(resetBox?.y).toBeGreaterThanOrEqual(box.y);
    expect((resetBox?.y ?? 480) + (resetBox?.height ?? 0)).toBeLessThanOrEqual(480);
    // DOM audit: replacing joined selects must also remove horizontal document overflow.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.close();
  });
});
