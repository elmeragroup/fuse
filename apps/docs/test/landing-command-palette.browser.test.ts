import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { isHighlighted } from "./command-page";
import { DESKTOP_VIEWPORT } from "./demo-page";
import {
  PHONE_VIEWPORT,
  dashboard,
  focusedCustomer,
  row,
  searchTable,
  DASHBOARD_FIRST,
} from "./landing-dashboard";
import { launchLandingSuite } from "./landing-page";

const { openLanding } = launchLandingSuite({ search: DASHBOARD_FIRST });

/** A query that matches several orders, so the active option can move off the first. */
const MULTI_RESULT_QUERY = "StrømSmart";

/** Searches the open palette, moves the highlight to the third result and checks it. */
async function searchAndMoveActive(page: Page, palette: Locator): Promise<void> {
  const field = palette.getByRole("combobox");
  await field.fill(MULTI_RESULT_QUERY);
  const third = palette.getByRole("option").nth(2);
  await third.waitFor();
  await expect.poll(async () => isHighlighted(palette.getByRole("option").first())).toBe(true);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect.poll(async () => isHighlighted(third)).toBe(true);
}

/** Asserts an empty field with the first result highlighted, as every opening starts. */
async function expectFreshSearch(palette: Locator): Promise<void> {
  const field = palette.getByRole("combobox");
  await field.waitFor();
  expect(await field.inputValue()).toBe("");
  await expect.poll(async () => isHighlighted(palette.getByRole("option").first())).toBe(true);
}

describe("landing Dashboard command palette", () => {
  it("opens the command palette from its button and from the keyboard, and jumps to an order", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const palette = page.getByRole("dialog", { name: "Command palette" });

    await app.getByRole("button", { name: /^Search/u }).click();
    await palette.waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => palette.count()).toBe(0);

    // ⌘K and Ctrl+K open the site's palette, even with focus in the window.
    await row(app, "Jonas Eide").focus();
    await page.keyboard.press("Control+k");
    const sitePalette = page.getByRole("dialog", { name: "Site search", exact: true });
    await sitePalette.waitFor();
    expect(await palette.count()).toBe(0);
    await page.keyboard.press("Escape");
    await expect.poll(async () => sitePalette.count()).toBe(0);
    await expect.poll(async () => focusedCustomer(page)).toBe("Jonas Eide");

    await page.keyboard.press("/");
    await palette.getByRole("combobox").fill("Henrik");
    await palette.getByRole("option", { name: /Henrik Aasen/u }).waitFor();
    await page.keyboard.press("Enter");

    await expect.poll(async () => palette.count()).toBe(0);
    // My orders does not hold Henrik Aasen's order, so the jump opens Order search and its Sheet.
    const detail = page.getByRole("dialog", { name: "Henrik Aasen" });
    await detail.waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => detail.count()).toBe(0);
    expect(
      await app.getByRole("button", { name: "Order search", exact: true }).getAttribute("aria-current")
    ).toBe("page");
    // Henrik Aasen's order is older than the ten newest, so the table turned to the page holding it.
    const henrik = searchTable(app)
      .getByRole("row")
      .filter({ has: page.getByRole("checkbox", { name: "Select Henrik Aasen" }) });
    await expect.poll(async () => henrik.isVisible()).toBe(true);

    // The reveal is served: a round trip through My orders reopens Order search on page one, which
    // holds the ten newest orders and not Henrik Aasen's.
    await app.getByRole("button", { name: /^My orders/u }).click();
    await expect.poll(async () => searchTable(app).count()).toBe(0);
    await app.getByRole("button", { name: "Order search", exact: true }).click();
    await searchTable(app).waitFor();
    await expect.poll(async () => searchTable(app).getAttribute("aria-busy")).toBeNull();
    // A header row and the page's ten order rows.
    expect(await searchTable(app).getByRole("row").count()).toBe(11);
    expect(await henrik.count()).toBe(0);
    await page.context().close();
  });

  it("opens the detail Sheet for an order picked from the palette on a phone", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    const palette = page.getByRole("dialog", { name: "Command palette" });

    await app.getByRole("button", { name: "Search", exact: true }).click();
    await palette.getByRole("combobox").fill("Henrik");
    await palette.getByRole("option", { name: /Henrik Aasen/u }).waitFor();
    await page.keyboard.press("Enter");

    await expect.poll(async () => palette.count()).toBe(0);
    await page.getByRole("dialog", { name: "Henrik Aasen" }).waitFor();
    await page.context().close();
  });

  it("reopens the palette from the sidebar Search with an empty search and the first result active", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    const search = app.getByRole("button", { name: /^Search/u });

    await search.click();
    await searchAndMoveActive(page, palette);
    await page.keyboard.press("Escape");
    await expect.poll(async () => palette.count()).toBe(0);

    await search.click();
    await expectFreshSearch(palette);
    await page.context().close();
  });

  it("returns focus to the row it opened from with `/`", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const palette = page.getByRole("dialog", { name: "Command palette" });

    await row(dashboard(page), "Jonas Eide").focus();
    await page.keyboard.press("/");
    await searchAndMoveActive(page, palette);
    await page.keyboard.press("Escape");
    await expect.poll(async () => palette.count()).toBe(0);
    await expect.poll(async () => focusedCustomer(page)).toBe("Jonas Eide");
    await page.context().close();
  });
});
