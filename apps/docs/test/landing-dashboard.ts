/**
 * What the hero window's browser suites share: the window and its Neutral/Branded switch, the
 * Dashboard and its rows, Order search's table, the brand sites, and the fixture facts more than
 * one suite asserts.
 */
import type { Locator, Page } from "playwright";
import { expect } from "vitest";

/** A phone's viewport, where the sidebar and the detail open as Sheets. */
export const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/**
 * The landing opens on the Branded side. A suite that exercises the Dashboard opens with this
 * query instead: the opening brand and segment in the neutral identity, so the window shows the
 * Dashboard from the first paint.
 */
export const DASHBOARD_FIRST = "?theme=neutral-elma-private";

/** The hero's live demo window: its chrome, the switch, and the side it shows. */
function liveDemo(page: Page): Locator {
  return page.getByRole("region", { name: "Live demo", exact: true });
}

/** The window's Dashboard, the Neutral side. */
export function dashboard(page: Page): Locator {
  return page.getByRole("region", { name: "Dashboard", exact: true });
}

/** A brand's website on the Branded side, named after the site: "Fjordkraft website". */
export function brandSite(page: Page, site: string): Locator {
  return page.getByRole("region", { name: `${site} website`, exact: true });
}

/** The DOM audit for a side the switch hid: the side sits in an inert subtree. */
async function isInert(side: Locator): Promise<boolean> {
  // DOM audit: an inert side has no role a query could reach, so the check reads the attribute.
  return side.evaluate((element) => element.closest("[inert]") !== null);
}

/**
 * The window's Neutral/Branded switch. `includeHidden` reaches it while an open modal hides
 * everything outside itself from assistive technology.
 */
export function sideSwitch(
  page: Page,
  { includeHidden = false }: { readonly includeHidden?: boolean } = {}
): Locator {
  return liveDemo(page).getByRole("group", { name: "Window content", includeHidden });
}

/**
 * The side the window shows: the switch's pressed button, checked against the side that is not
 * inert, so a switch that disagrees with its window fails here. A Dashboard that has not mounted
 * yet, because Neutral never showed, counts as hidden.
 */
export async function shownSide(page: Page): Promise<"Neutral" | "Branded" | "mismatch"> {
  const pressed = (await sideSwitch(page).getByRole("button", { pressed: true }).textContent()) ?? "";
  const dashboardInert = (await dashboard(page).count()) === 0 || (await isInert(dashboard(page)));
  if (pressed === "Neutral" && !dashboardInert) {
    return "Neutral";
  }
  if (pressed === "Branded" && dashboardInert) {
    return "Branded";
  }
  return "mismatch";
}

/**
 * Picks `brand` in the landing's brand picker, the same action as any other brand control, and
 * waits for the document to wear it, within `timeout` when given.
 */
export async function pickBrand(
  page: Page,
  brand: string,
  { timeout }: { readonly timeout?: number } = {}
): Promise<void> {
  await page
    .getByRole("button")
    .filter({ hasText: `data-theme-brand="${brand}"` })
    .click();
  await expect
    .poll(async () => page.locator("html").getAttribute("data-theme-brand"), { timeout })
    .toBe(brand);
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

/** Order search's table, named like the queues' list. */
export function searchTable(app: Locator): Locator {
  return app.getByRole("table", { name: "Orders" });
}

/**
 * Opens New order from the window's sidebar and waits for its Sheet and the form, whose code can
 * arrive after the Sheet has opened.
 */
export async function openNewOrder(app: Locator): Promise<Locator> {
  await app.getByRole("button", { name: /^New order/u }).click();
  const sheet = app.page().getByRole("dialog", { name: "New order" });
  await sheet.getByRole("form", { name: "New order" }).waitFor();
  return sheet;
}
