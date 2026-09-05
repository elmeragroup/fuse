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

async function openComponentPage(page: Page, slug: string): Promise<Locator> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  await page.getByRole("heading", { name: "Item group", exact: true }).waitFor();
  return page.getByRole("region", { name: "Item group" });
}

async function hasInertAncestor(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    let current: Element | null = el;
    while (current) {
      if (current instanceof HTMLElement && current.inert) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  });
}

async function proveHiddenCopyIsBlocked(page: Page, extra: Locator): Promise<void> {
  expect(await hasInertAncestor(extra)).toBe(true);
  const tookFocus = await extra.evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      throw new Error("expected subsection to be an HTMLElement");
    }
    const previous = document.activeElement;
    el.tabIndex = 0;
    el.focus();
    const focused = document.activeElement === el;
    el.removeAttribute("tabindex");
    if (previous instanceof HTMLElement) {
      previous.focus();
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    return focused;
  });
  expect(tookFocus).toBe(false);

  const box = await extra.boundingBox();
  if (box !== null && box.width > 0 && box.height > 0) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
}

describe("Selection-family item-group demos", () => {
  it("hides the CheckboxItemGroup Fixed-price subsection behind inert after unchecking", async () => {
    const page = await browser.newPage();
    const demo = await openComponentPage(page, "checkbox");
    const group = demo.getByRole("group", { name: "Price plans" });
    const extra = group.getByRole("region", { name: "Fixed price details", exact: true });
    const fixed = group.getByRole("checkbox", { name: "Fixed price" });

    await extra.waitFor();
    expect(await extra.isVisible()).toBe(true);
    expect(await hasInertAncestor(extra)).toBe(false);
    await expect.poll(async () => fixed.getAttribute("aria-checked")).toBe("true");

    await fixed.click();
    await expect.poll(async () => fixed.getAttribute("aria-checked")).toBe("false");
    const hiddenExtra = group.getByRole("region", {
      name: "Fixed price details",
      exact: true,
      includeHidden: true,
    });
    expect(await hasInertAncestor(hiddenExtra)).toBe(true);
    await proveHiddenCopyIsBlocked(page, hiddenExtra);
    expect(await fixed.getAttribute("aria-checked")).toBe("false");

    await page.close();
  });

  it("hides the RadioItemGroup Fixed-price subsection behind inert after choosing Spot", async () => {
    const page = await browser.newPage();
    const demo = await openComponentPage(page, "radio-group");
    const group = demo.getByRole("radiogroup", { name: "Price plans" });
    const extra = group.getByRole("region", { name: "Fixed price details", exact: true });
    const fixed = group.getByRole("radio", { name: "Fixed price" });
    const spot = group.getByRole("radio", { name: "Spot price" });

    await extra.waitFor();
    expect(await extra.isVisible()).toBe(true);
    expect(await hasInertAncestor(extra)).toBe(false);
    await expect.poll(async () => fixed.getAttribute("aria-checked")).toBe("true");

    await spot.click();
    await expect.poll(async () => spot.getAttribute("aria-checked")).toBe("true");
    await expect.poll(async () => fixed.getAttribute("aria-checked")).toBe("false");
    const hiddenExtra = group.getByRole("region", {
      name: "Fixed price details",
      exact: true,
      includeHidden: true,
    });
    expect(await hasInertAncestor(hiddenExtra)).toBe(true);
    await proveHiddenCopyIsBlocked(page, hiddenExtra);
    expect(await spot.getAttribute("aria-checked")).toBe("true");
    expect(await fixed.getAttribute("aria-checked")).toBe("false");

    await page.close();
  });
});
