import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

describe("DataTableFilter demos", () => {
  it("filters the client demo's orders from a value submenu, live under the open menu", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "data-table-filter", "Client filtering");
    const rows = demo.getByRole("table", { name: "Orders" }).getByRole("row").filter({ hasText: /^ORD-/ });
    await expect.poll(() => rows.count()).toBe(8);

    await demo.getByRole("button", { name: "Filter", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Add filter" });
    await menu.getByRole("menuitem", { name: "Status", exact: true }).click();
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

    await demo.getByRole("button", { name: "Filter", exact: true }).click();
    await page.getByRole("menuitem", { name: "Status", exact: true }).click();
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
});
