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

/**
 * The `hashchange` listeners registered on `window`, counted by the browser itself through
 * the DevTools protocol — no spies, no instrumentation of the page's own code.
 */
async function hashchangeListenerCount(page: Page): Promise<number> {
  const session = await page.context().newCDPSession(page);
  try {
    const { result } = await session.send("Runtime.evaluate", { expression: "window" });
    if (result.objectId === undefined) {
      throw new Error("expected a remote object id for window");
    }
    const { listeners } = await session.send("DOMDebugger.getEventListeners", { objectId: result.objectId });
    return listeners.filter((listener) => listener.type === "hashchange").length;
  } finally {
    await session.detach();
  }
}

/** Whether the `details` row whose `summary` carries `id` is open. */
async function rowIsOpen(page: Page, id: string): Promise<boolean> {
  return page.locator(`#${id}`).evaluate((summary) => {
    const row = summary.closest("details");
    if (!(row instanceof HTMLDetailsElement)) {
      throw new Error(`expected ${summary.id} to be the summary of a details row`);
    }
    return row.open;
  });
}

const BUTTON_API = "/components/button";
const DEEP_LINK = "api-button-isVisuallyDisabled";
const SECOND_ROW = "api-button-onIntent";

describe("API prop rows share one hash listener (docs-site.md §8)", () => {
  it("registers one hashchange listener per prop group, however many rows the page mounts", async () => {
    const page = await browser.newPage();

    // A page without an API reference: whatever else on the site listens to the hash.
    await page.goto(`${docsBaseUrl()}/handbook/tokens`, { waitUntil: "networkidle" });
    const baseline = await hashchangeListenerCount(page);

    // Arriving through a deep link opens the named row; that open proves hydration ran and
    // the listeners are registered before they are counted.
    await page.goto(`${docsBaseUrl()}${BUTTON_API}#${DEEP_LINK}`, { waitUntil: "load" });
    await page.locator(`#${DEEP_LINK}`).waitFor();
    await expect.poll(() => rowIsOpen(page, DEEP_LINK)).toBe(true);

    const groups = await page.getByRole("group", { name: /Each row expands\.$/ }).count();
    const rows = await page.locator("details").count();
    expect(groups).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(groups);
    expect((await hashchangeListenerCount(page)) - baseline).toBe(groups);

    await page.close();
  });

  it("opens the row the hash names after an in-page navigation", async () => {
    const page = await browser.newPage();
    await page.goto(`${docsBaseUrl()}${BUTTON_API}#${DEEP_LINK}`, { waitUntil: "load" });
    await expect.poll(() => rowIsOpen(page, DEEP_LINK)).toBe(true);
    expect(await rowIsOpen(page, SECOND_ROW)).toBe(false);

    await page.evaluate((id) => {
      window.location.hash = `#${id}`;
    }, SECOND_ROW);
    await expect.poll(() => rowIsOpen(page, SECOND_ROW)).toBe(true);

    await page.close();
  });
});
