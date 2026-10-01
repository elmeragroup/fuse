import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, launchSuiteBrowser, openDemo } from "./demo-page";

const browser = launchSuiteBrowser();

const INVENTORY = "Inventory with filters and row actions";

describe("DataTable demos", () => {
  it("narrows the inventory by search and stock status, clears the filters, and runs a row action", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const demo = await openDemo(page, "data-table", INVENTORY);
    const table = demo.getByRole("table", { name: "Inventory" });
    const productRows = table
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: /^Actions for / }) });

    await expect.poll(() => productRows.count()).toBe(5);

    await demo.getByRole("textbox", { name: "Search products" }).fill("acc-033");
    await expect.poll(() => productRows.count()).toBe(1);
    await expect.poll(() => productRows.first().textContent()).toContain("USB-C Docking Station");

    await demo.getByRole("textbox", { name: "Search products" }).fill("");
    await expect.poll(() => productRows.count()).toBe(5);

    await demo.getByRole("combobox", { name: "Stock status" }).click();
    await page.getByRole("option", { name: "Low Stock", exact: true }).click();
    await expect.poll(() => productRows.count()).toBe(2);

    await demo.getByRole("textbox", { name: "Search products" }).fill("chair");
    await expect.poll(() => productRows.count()).toBe(0);
    await demo.getByRole("button", { name: "Clear filters", exact: true }).click();
    await expect.poll(() => productRows.count()).toBe(5);
    await expect.poll(() => demo.getByRole("textbox", { name: "Search products" }).inputValue()).toBe("");

    await demo.getByRole("button", { name: "Actions for USB-C Docking Station", exact: true }).click();
    await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
    await expect.poll(() => demo.getByRole("status").textContent()).toBe("Archived USB-C Docking Station");
    await page.close();
  });
});
