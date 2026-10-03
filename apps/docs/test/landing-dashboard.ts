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

/** Opens New order from the window's sidebar and waits for its Sheet. */
export async function openNewOrder(app: Locator): Promise<Locator> {
  await app.getByRole("button", { name: /^New order/u }).click();
  const sheet = app.page().getByRole("dialog", { name: "New order" });
  await sheet.waitFor();
  return sheet;
}

/** The window's theme scope: the box its Sheets fill and its popups stay in. */
export function windowScope(app: Locator): Locator {
  // DOM audit: ThemeScope's element has no role; it is the window's only themed element.
  return app.locator("[data-theme-variant]");
}

/**
 * Scrolls the page so the window's top sits above the viewport and its body part way up it, as a
 * visitor sees it after scrolling past the hero's headline.
 */
export async function scrollWindowPartWay(page: Page): Promise<void> {
  const top = await dashboard(page).evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY
  );
  await page.evaluate((y) => {
    window.scrollTo(0, y);
  }, top + 80);
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
}

/**
 * How far a popup may sit from its trigger: Base UI popups sit 4px off and the react-aria
 * popover 8px, plus slack for borders and subpixel rounding.
 */
const POPUP_GAP_PX = 12;

/**
 * Polls until `popup` opens next to `trigger`: within 8px of one of its sides, overlapping it on
 * the other axis, and inside the window's scope.
 */
export async function expectBeside(popup: Locator, trigger: Locator, scope: Locator): Promise<void> {
  await expect
    .poll(async () => {
      const [p, t, s] = await Promise.all([popup.boundingBox(), trigger.boundingBox(), scope.boundingBox()]);
      if (p === null || t === null || s === null) {
        return "not rendered";
      }
      const near = (gap: number) => gap >= -1 && gap <= POPUP_GAP_PX;
      const crossesX = p.x < t.x + t.width && p.x + p.width > t.x;
      const crossesY = p.y < t.y + t.height && p.y + p.height > t.y;
      const beside =
        (crossesX && (near(p.y - (t.y + t.height)) || near(t.y - (p.y + p.height)))) ||
        (crossesY && (near(p.x - (t.x + t.width)) || near(t.x - (p.x + p.width))));
      const inside =
        p.x >= s.x - 1 &&
        p.y >= s.y - 1 &&
        p.x + p.width <= s.x + s.width + 1 &&
        p.y + p.height <= s.y + s.height + 1;
      return beside && inside ? "beside" : `popup ${JSON.stringify(p)}, trigger ${JSON.stringify(t)}`;
    })
    .toBe("beside");
}
