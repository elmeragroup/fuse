import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

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

/** Searches the open palette, moves the active option to the third result and checks it. */
async function searchAndMoveActive(page: Page, palette: Locator): Promise<void> {
  const field = palette.getByRole("combobox");
  await field.fill(MULTI_RESULT_QUERY);
  const third = palette.getByRole("option").nth(2);
  await third.waitFor();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  expect(await third.getAttribute("aria-selected")).toBe("true");
  expect(await field.getAttribute("aria-activedescendant")).toBe(await third.getAttribute("id"));
}

/** Asserts an empty field with the first result active, as every opening starts. */
async function expectFreshSearch(palette: Locator): Promise<void> {
  const field = palette.getByRole("combobox");
  await field.waitFor();
  expect(await field.inputValue()).toBe("");
  const first = palette.getByRole("option").first();
  expect(await first.getAttribute("aria-selected")).toBe("true");
  expect(await field.getAttribute("aria-activedescendant")).toBe(await first.getAttribute("id"));
}

/** Every way into the palette, each at the width where it shows. */
const PALETTE_OPENERS = [
  {
    opener: "the sidebar Search",
    viewport: DESKTOP_VIEWPORT,
    open: async (page: Page) =>
      dashboard(page)
        .getByRole("button", { name: /^Search/u })
        .click(),
  },
  {
    opener: "Control+K",
    viewport: DESKTOP_VIEWPORT,
    open: async (page: Page) => {
      await row(dashboard(page), "Jonas Eide").focus();
      await page.keyboard.press("Control+k");
    },
  },
  {
    opener: "the header Search button",
    viewport: PHONE_VIEWPORT,
    open: async (page: Page) => dashboard(page).getByRole("button", { name: "Search", exact: true }).click(),
  },
] as const;

describe("landing Dashboard command palette", () => {
  it("opens the command palette from its button and from the keyboard, and jumps to an order", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const palette = page.getByRole("dialog", { name: "Command palette" });

    await app.getByRole("button", { name: /^Search/u }).click();
    await palette.waitFor();
    await page.keyboard.press("Escape");
    await expect.poll(async () => palette.count()).toBe(0);

    await row(app, "Jonas Eide").focus();
    await page.keyboard.press("Control+k");
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

  it.each(PALETTE_OPENERS)(
    "reopens the palette from $opener with an empty search and the first result active",
    async ({ viewport, open }) => {
      const page = await openLanding(viewport);
      await dashboard(page).scrollIntoViewIfNeeded();
      const palette = page.getByRole("dialog", { name: "Command palette" });

      await open(page);
      await searchAndMoveActive(page, palette);
      await page.keyboard.press("Escape");
      await expect.poll(async () => palette.count()).toBe(0);

      await open(page);
      await expectFreshSearch(palette);
      await page.context().close();
    }
  );

  it("starts a fresh search and returns focus to the row when the palette reopens before its exit animation ends", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT, { reducedMotion: "no-preference" });
    // Slow every animation tenfold, so the popup's exit is still running when Control+K lands.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.1 });
    const palette = page.getByRole("dialog", { name: "Command palette" });

    await row(dashboard(page), "Jonas Eide").focus();
    await page.keyboard.press("Control+k");
    await searchAndMoveActive(page, palette);
    const popup = await palette.elementHandle();
    await page.keyboard.press("Escape");
    await expect.poll(async () => popup.getAttribute("data-closed")).toBe("");
    await page.keyboard.press("Control+k");

    // The same popup node: it never unmounted, so only a fresh opening can have reset the search.
    expect(await popup.evaluate((node) => node.isConnected)).toBe(true);
    await expectFreshSearch(palette);

    // The reopen remounted the search field that held focus, so the row stays the invoker.
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
    await page.keyboard.press("Escape");
    await expect.poll(async () => palette.count()).toBe(0);
    expect(await focusedCustomer(page)).toBe("Jonas Eide");
    await page.context().close();
  });
});
