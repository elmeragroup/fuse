import { chromium } from "playwright";
import type { Browser, Locator, Page } from "playwright";
import { afterAll, beforeAll, expect } from "vitest";

import { docsBaseUrl } from "./docs-server";

/** The desktop viewport the layout-sensitive demo suites run at. */
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

/**
 * The docs browser suites share one headless Chromium per file. The getter is lazy
 * because the instance only exists between the registered `beforeAll` and `afterAll`.
 */
export function launchSuiteBrowser(): () => Browser {
  let launched: Browser | null = null;

  beforeAll(async () => {
    launched = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    if (launched !== null) {
      await launched.close();
      launched = null;
    }
  });

  return () => {
    if (launched === null) {
      throw new Error("The suite browser is only available between beforeAll and afterAll.");
    }
    return launched;
  };
}

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
