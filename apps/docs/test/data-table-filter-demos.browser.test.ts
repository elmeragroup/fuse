import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import {
  DESKTOP_VIEWPORT,
  expectInside,
  launchSuiteBrowser,
  openDemo,
  shareDemoPage,
  sharedDemo,
} from "./demo-page";

const browser = launchSuiteBrowser();

/**
 * Opens a demo's add menu and its Status value submenu from the keyboard. A pointer opens the
 * submenu on hover, which ties it to the pointer: on a loaded CI runner it closed with the pointer
 * still on the Status row, and the next click found the closing, inert submenu.
 */
async function openStatusSubmenu(page: Page, demo: Locator): Promise<void> {
  await demo.getByRole("button", { name: "Filter", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("searchbox", { name: "Search fields", exact: true }).fill("Status");
  const status = page.getByRole("menuitem", { name: "Status", exact: true });
  await expect.poll(() => status.getAttribute("data-highlighted")).not.toBeNull();
  await page.keyboard.press("ArrowRight");
  // The submenu is open once its search holds focus.
  const search = page.getByRole("searchbox", { name: "Search Status", exact: true });
  await expect.poll(() => search.evaluate((element) => element === document.activeElement)).toBe(true);
}

describe("DataTableFilter demos", () => {
  it("filters the client demo's orders from a value submenu, live under the open menu", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "data-table-filter", "Client filtering");
    const rows = demo.getByRole("table", { name: "Orders" }).getByRole("row").filter({ hasText: /^ORD-/ });
    await expect.poll(() => rows.count()).toBe(8);

    await openStatusSubmenu(page, demo);
    const menu = page.getByRole("dialog", { name: "Add filter" });
    await page.getByRole("menuitemcheckbox", { name: "Overdue", exact: true }).click();
    await expect.poll(() => demo.getByRole("group", { name: "Status filter" }).count()).toBe(1);
    // Every seventh order from the fourth is overdue: 6 of the 40.
    await expect.poll(() => rows.count()).toBe(6);
    await expect.poll(() => rows.filter({ hasText: "Overdue" }).count()).toBe(6);
    await expect.poll(() => menu.isVisible()).toBe(true);
    await page.close();
  });

  it("sends the server demo's filters and shows the rows and counts it returns", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "data-table-filter", "Server filtering with facets");
    const rows = demo.getByRole("table", { name: "Orders" }).getByRole("row").filter({ hasText: /^ORD-/ });
    await expect.poll(() => rows.count()).toBe(8);

    await openStatusSubmenu(page, demo);
    // 120 orders cycle through seven statuses, one of them draft: 17 drafts.
    const draft = page.getByRole("menuitemcheckbox", { name: "Draft", exact: true });
    await expect.poll(() => draft.textContent()).toBe("Draft17");
    await draft.click();
    await expect.poll(() => rows.filter({ hasText: "Draft" }).count()).toBe(8);
    await page.close();
  });

  it("caps the 3,000 products at 50 rows and asks for more typing", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "data-table-filter", "3,000 options");
    await demo.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("menuitem", { name: "Product", exact: true }).click();
    await expect.poll(() => page.getByRole("menuitemcheckbox").count()).toBe(50);
    await expect
      .poll(() => page.getByRole("status").filter({ hasText: "Type to narrow the list" }).count())
      .toBe(1);
    await page.getByRole("searchbox", { name: "Search Product" }).fill("walnut lamp 160");
    await expect.poll(() => page.getByRole("menuitemcheckbox").count()).toBe(1);
    await page.close();
  });

  it("drills the calendar demo's date field into a range calendar inside the menu", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "data-table-filter", "Full composition with a calendar");
    await demo.getByRole("button", { name: "Filter", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Add filter" });
    await menu.getByRole("menuitem", { name: "Created", exact: true }).click();
    await expect.poll(() => menu.getByRole("grid").count()).toBe(1);
    await expect
      .poll(() => menu.getByRole("button", { name: "Back to fields", exact: true }).count())
      .toBe(1);
    await page.close();
  });

  // A centred stage spills a too-wide demo past its left edge, where nothing scrolls to it. Each
  // demo fills its stage instead: the bar wraps or scrolls its own strip, and the table scrolls in
  // its own container.
  const DEMOS = [
    "Client filtering",
    "Server filtering with facets",
    "3,000 options",
    "Full composition with a calendar",
  ];
  // Read-only checks, so each width loads the page once for every demo.
  describe.each([390, 1280])("at %ipx", (width) => {
    const sharedPage = shareDemoPage(browser, "data-table-filter", { width, height: 844 });

    it.each(DEMOS)("keeps the %s demo's bar and table inside its stage", async (name) => {
      const demo = await sharedDemo(sharedPage(), name);
      // DOM audit: the stage and the table's scroll container have no landmark role of their own.
      const stage = demo.locator("[data-demo-stage]");
      await expectInside(demo.getByRole("toolbar", { name: "Order filters", exact: true }), stage);
      await expectInside(demo.locator('[data-slot="table-container"]'), stage);
    });
  });
});
