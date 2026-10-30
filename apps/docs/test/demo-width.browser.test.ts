import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { COMPONENT_INVENTORY } from "./component-inventory";
import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";
import { readDemoWidths } from "./demo-width";
import type { WidthViolation } from "./demo-width";
import { docsBaseUrl } from "./docs-server";

const browser = launchSuiteBrowser();

/** The narrow phone window the docs support. */
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** Pages whose demos run from the stage's full width down: wide tables, surfaces and controls. */
const PHONE_PAGES = [
  "frame",
  "data-table",
  "table",
  "button",
  "collapsible",
  "date-picker",
  "card",
  "scroll-area",
] as const;

/** Opens a component page and waits until every demo on it has hydrated. */
async function openPage(page: Page, slug: string): Promise<void> {
  await page.goto(`${docsBaseUrl()}/components/${slug}`, { waitUntil: "load" });
  await page.waitForFunction(
    () =>
      document.querySelectorAll("[data-demo-frame]").length ===
      document.querySelectorAll("[data-demo-frame][data-demo-hydrated]").length
  );
}

/** Every demo root on the given pages that breaks the stage's width rule, named by its page. */
async function sweep(
  slugs: readonly string[],
  viewport: { readonly width: number; readonly height: number }
): Promise<string[]> {
  const page = await browser().newPage({ viewport });
  page.setDefaultTimeout(10_000);
  const found: string[] = [];
  for (const slug of slugs) {
    await openPage(page, slug);
    const violations: WidthViolation[] = await page.evaluate(readDemoWidths);
    found.push(
      ...violations.map(({ demo, root, reason }) => `/components/${slug}#${demo} ${root}: ${reason}`)
    );
  }
  await page.close();
  return found;
}

describe("demo width", () => {
  // The rule, read from layout: a block-level demo root with no width of its own fills the stage up
  // to its own max-width, an inline-level root sits centred at its own width, and no root, however
  // it is sized, runs out of the stage.
  it("fills the stage with every block-level demo and centres every inline-level one", async () => {
    expect(await sweep([...COMPONENT_INVENTORY.keys()], DESKTOP_VIEWPORT)).toEqual([]);
  }, 600_000);

  it("holds the rule in a 390px window", async () => {
    expect(await sweep(PHONE_PAGES, PHONE_VIEWPORT)).toEqual([]);
  }, 120_000);

  it("keeps the Collapsible panels demo's width while its panels open and close", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "frame", "Collapsible panels");
    // DOM audit: the demo's Frame is the stage's only child; the stage is the frame's one hook.
    const stage = demo.locator("[data-demo-stage]");
    const frame = stage.locator("> *").first();
    const width = async (): Promise<number | undefined> => (await frame.boundingBox())?.width;
    // The demo caps its Frame at `max-w-md`, 28rem: 448px, which the desktop stage is wider than.
    expect(await width()).toBe(448);
    await stage.getByRole("button", { name: "Calculate invoices" }).click();
    await expect.poll(() => stage.getByText("Price the readings").isVisible()).toBe(true);
    expect(await width()).toBe(448);
    await stage.getByRole("button", { name: "Collect readings" }).click();
    await stage.getByRole("button", { name: "Calculate invoices" }).click();
    await expect.poll(() => stage.getByText("Price the readings").isVisible()).toBe(false);
    expect(await width()).toBe(448);
    await page.close();
  });
});
