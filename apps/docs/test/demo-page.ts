import type { Locator, Page } from "playwright";
import { expect } from "vitest";

import { docsBaseUrl } from "./docs-server";

export { launchSuiteBrowser } from "./suite-browser";

/** The desktop viewport the layout-sensitive demo suites run at. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

/**
 * Navigates `page` to a component page and returns the region the docs shell renders
 * around the demo titled `name`.
 */
export async function openDemo(page: Page, slug: string, name: string): Promise<Locator> {
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  const demo = page.getByRole("region", { name, exact: true });
  await demo.waitFor();
  return demo;
}

/** The theme axes a docs suite reads off a preview stage, the document root, or any scope. */
export type ThemeAttributes = {
  variant: string | null;
  brand: string | null;
  segment: string | null;
};

/**
 * Reads the three theme axes off `element`. Suites assert the same shape whether they are
 * auditing the document root or a demo stage, so the read lives here once.
 */
export async function readThemeAttributes(element: Locator): Promise<ThemeAttributes> {
  return element.evaluate((node) => ({
    variant: node.getAttribute("data-theme-variant"),
    brand: node.getAttribute("data-theme-brand"),
    segment: node.getAttribute("data-theme-segment"),
  }));
}

/**
 * Polls until `element` sits inside `container` on the horizontal axis. Vertical
 * containment is deliberately not asserted: some demos scroll by design.
 */
export async function expectInside(element: Locator, container: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const outer = await container.boundingBox();
      const inner = await element.boundingBox();
      return (
        outer !== null &&
        inner !== null &&
        inner.x >= outer.x - 1 &&
        inner.x + inner.width <= outer.x + outer.width + 1
      );
    })
    .toBe(true);
}
