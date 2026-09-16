import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";

import { docsBaseUrl } from "./docs-server";

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

async function expectRole(page: Page, selector: string, property: string, token: string): Promise<void> {
  const result = await page
    .locator(selector)
    .first()
    .evaluate(
      (element, { property, token }) => {
        const reference = document.createElement("span");
        reference.style.setProperty(property, `var(--${token})`);
        element.append(reference);
        const expected = getComputedStyle(reference).getPropertyValue(property);
        const actual = getComputedStyle(element).getPropertyValue(property);
        reference.remove();
        return { actual, expected };
      },
      { property, token }
    );
  expect(result.actual, `${selector} ${property} uses --${token}`).toBe(result.expected);
}

it.each(["/", "/handbook/theming", "/handbook/theme-matrix", "/components/button"])(
  "paints %s from internal Elmera tokens when data-theme changes manually",
  async (path) => {
    const page = await browser.newPage({ colorScheme: "light" });
    await page.goto(`${docsBaseUrl()}${path}`, { waitUntil: "networkidle" });
    for (const scheme of ["light", "dark", "light"] as const) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), scheme);
      await page
        .getByRole("button", { name: "Theme settings", exact: true })
        .evaluate((element) =>
          Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
        );
      const html = page.locator("html");
      expect(await html.getAttribute("data-theme-variant")).toBe("internal");
      expect(await html.getAttribute("data-theme-brand")).toBe("elma");
      expect(await html.getAttribute("data-theme-segment")).toBe("private");
      expect(await page.locator("body").evaluate((el) => getComputedStyle(el).colorScheme)).toBe(scheme);
      for (const selector of ["html", "body", "[data-docs-root]"]) {
        await expectRole(page, selector, "background-color", "background");
        await expectRole(page, selector, "color", "foreground");
      }
      await expectRole(page, "body", "font-family", "font-sans");
      await expectRole(page, "main h1", "font-family", "font-heading");
      await expectRole(page, "main h1", "color", "foreground");
      await expectRole(page, "main p", "color", "foreground");
      await expectRole(page, "header", "border-bottom-color", "border");
      await expectRole(
        page,
        'nav[aria-label="Main navigation"] a[href="/quick-start"]',
        "color",
        "muted-foreground"
      );
      await expectRole(page, 'button[aria-label="Theme settings"]', "background-color", "background");
      await expectRole(page, 'button[aria-label="Theme settings"]', "border-top-color", "border");
      await expectRole(page, 'button[aria-label="Theme settings"]', "color", "foreground");
      if (path === "/handbook/theming") {
        await expectRole(page, "main pre", "background-color", "card");
        await expectRole(page, "main pre", "font-family", "font-mono");
      }
    }
    await page.close();
  }
);

it.each([
  ["/components/tabs", "[data-api-rows-header]"],
  ["/components/button", "[data-demo-meta]"],
] as const)("keeps the %s label band on --card in both schemes", async (path, selector) => {
  const page = await browser.newPage({ colorScheme: "light" });
  await page.goto(`${docsBaseUrl()}${path}`, { waitUntil: "networkidle" });
  for (const scheme of ["light", "dark"] as const) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), scheme);
    await expectRole(page, selector, "background-color", "card");
  }
  await page.close();
});

it("keeps search overlays in the document's dark palette", async () => {
  const page = await browser.newPage({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`${docsBaseUrl()}/components/button`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Search ⌘K", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  );
  await expectRole(page, '[role="dialog"]', "background-color", "popover");
  await expectRole(page, '[role="dialog"]', "color", "popover-foreground");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
  await page.close();
});
