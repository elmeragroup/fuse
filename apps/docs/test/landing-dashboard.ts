/**
 * What the Dashboard window's browser suites share: the window, its rows, Order search's table
 * and the fixture facts more than one suite asserts.
 */
import type { Locator, Page } from "playwright";
import { expect } from "vitest";

/** A phone's viewport, where the sidebar and the detail open as Sheets. */
export const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** A wide desktop viewport, where the queues show their detail beside the list. */
export const WIDE_VIEWPORT = { width: 1440, height: 900 } as const;

/**
 * Open orders per sidebar entry as the fixture states them: the signed-in seller's 12 drafts and
 * 3 orders with telemarketing, and 12 orders with telemarketing in all.
 */
export const OPEN_COUNTS = { "My orders": "26", Drafts: "12", "Establishment stopped": "12" } as const;

/** The landing's Dashboard window. */
export function dashboard(page: Page): Locator {
  return page.getByRole("region", { name: "Dashboard", exact: true });
}

/** The row button for `customer`; its accessible name starts with the order's customer. */
export function row(scope: Locator, customer: string): Locator {
  return scope
    .getByRole("list", { name: "Orders" })
    .getByRole("button", { name: new RegExp(`^${customer}`, "u") });
}

/** The customer of the focused row's opener, or `null` when no row has focus. */
export async function focusedCustomer(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("data-customer") ?? null);
}

/** Ida Hagen's metering point as the fixture states it. */
export const IDA_METER_POINT = "707057500050172948";

/** Order search's table, named like the queues' list. */
export function searchTable(app: Locator): Locator {
  return app.getByRole("table", { name: "Orders" });
}

/** Opens Order search and waits for its simulated fetch to finish. */
export async function openOrderSearch(page: Page): Promise<Locator> {
  const app = dashboard(page);
  await app.scrollIntoViewIfNeeded();
  await app.getByRole("button", { name: "Order search", exact: true }).click();
  await searchTable(app).waitFor();
  await expect.poll(async () => searchTable(app).getAttribute("aria-busy")).toBeNull();
  return app;
}
