// Unit under test: the app shell block as the docs build serves it, standalone at its preview route
// and framed on its docs page. Oracles: the counts the data module's cycles give, worked by hand in
// its comments (480 points, 48 in NO4, 24 of them on a fixed price, none disconnected; 72 invoices,
// 6 of them overdue), March's 31 days, the docs header's theme picker, and the fonts page's rule:
// a neutral theme draws Inter and a branded one Roboto.
import type { Page } from "playwright";
import { describe, expect, it } from "vitest";

import { METERING_POINTS, PRICE_AREA_NAMES } from "../src/app/(docs)/blocks/app-shell/demos/power-data";
import { DESKTOP_VIEWPORT, launchSuiteBrowser, waitForDocsShellHydration } from "./demo-page";
import { docsBaseUrl } from "./docs-server";
import { drawnFace } from "./drawn-face";
import { openFilterSubmenu } from "./filter-menu";
import { collectPageErrors } from "./landing-page";

const browser = launchSuiteBrowser();

const BASE = "/blocks/app-shell/preview";
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;

/** Every page of the block: its route and its heading. */
const PAGES = [
  { path: BASE, heading: "Overview" },
  { path: `${BASE}/metering-points`, heading: "Metering points" },
  { path: `${BASE}/invoices`, heading: "Invoices" },
  { path: `${BASE}/settings`, heading: "Settings" },
] as const;

/** Opens a block route and waits until React has hydrated its header. */
async function openApp(page: Page, path: string): Promise<void> {
  page.setDefaultTimeout(5000);
  await page.goto(`${docsBaseUrl()}${path}`, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const header = document.querySelector("header");
    return header !== null && Object.keys(header).some((key) => key.startsWith("__reactFiber"));
  });
}

async function heading(page: Page): Promise<string | null> {
  return page.getByRole("heading", { level: 1 }).textContent();
}

/** Ticks one value of a filter field, then closes the menus. */
async function filterBy(page: Page, field: string, value: string): Promise<void> {
  await openFilterSubmenu(page, page, field);
  await page.getByRole("menuitemcheckbox", { name: value, exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.getByRole("dialog", { name: "Add filter" }).count()).toBe(0);
}

/** The `data-slot` of the focused element, or `null`. */
async function activeSlot(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute("data-slot") ?? null);
}

/** The text of the page title when it holds focus, or `null` when focus is elsewhere. */
async function activeTitle(page: Page): Promise<string | null> {
  return page.evaluate(() =>
    document.activeElement?.matches("[data-page-title]") === true ? document.activeElement.textContent : null
  );
}

function pointsStatus(page: Page) {
  return page.getByRole("status").filter({ hasText: /metering points?( of|$)/u });
}

describe("the app shell block, standalone", () => {
  it.each(PAGES)(
    "serves $path with its heading and hydrates without an error",
    async ({ path, heading: title }) => {
      const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT, timezoneId: "Europe/Oslo" });
      const errors = collectPageErrors(page, { console: true });
      await openApp(page, path);
      expect(await heading(page)).toBe(title);
      expect(errors).toEqual([]);
      await page.close();
    }
  );

  it("routes every sidebar entry to its page", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, BASE);
    const sidebar = page.locator('[data-slot="sidebar"]');
    for (const { path, heading: title } of [...PAGES.slice(1), PAGES[0]]) {
      await sidebar.getByRole("link", { name: new RegExp(`^${title}`, "u") }).click();
      await expect.poll(() => new URL(page.url()).pathname).toBe(path);
      await expect.poll(() => heading(page)).toBe(title);
      const current = sidebar.getByRole("link", { name: new RegExp(`^${title}`, "u") });
      expect(await current.getAttribute("aria-current")).toBe("page");
    }
    await page.close();
  });

  it("reaches every page from the command menu", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, BASE);
    for (const { path, heading: title } of [...PAGES.slice(1), PAGES[0]]) {
      await page.keyboard.press("Control+k");
      const input = page.getByRole("combobox", { name: "Search pages and actions" });
      await input.fill(title);
      await page.keyboard.press("Enter");
      await expect.poll(() => new URL(page.url()).pathname).toBe(path);
      await expect.poll(() => heading(page)).toBe(title);
    }
    await page.close();
  });

  it("collapses the sidebar to icons on desktop", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, BASE);
    const sidebar = page.locator('[data-slot="sidebar"][data-collapsible]').first();
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    await expect.poll(() => sidebar.getAttribute("data-state")).toBe("collapsed");
    expect(await sidebar.getAttribute("data-collapsible")).toBe("icon");
    // The pages stay one click away, as icons.
    const link = page.getByRole("link", { name: /^Invoices/u });
    await expect.poll(async () => (await link.boundingBox())?.width ?? 0).toBeLessThan(48);
    await link.click();
    await expect.poll(() => heading(page)).toBe("Invoices");
    await page.close();
  });

  it("opens the sidebar as a sheet on a phone, and a page link closes it", async () => {
    const page = await browser().newPage({ viewport: PHONE_VIEWPORT });
    await openApp(page, BASE);
    expect(await page.getByRole("link", { name: /^Invoices/u }).isVisible()).toBe(false);
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect.poll(() => sheet.isVisible()).toBe(true);
    await sheet.getByRole("link", { name: /^Invoices/u }).click();
    await expect.poll(() => heading(page)).toBe("Invoices");
    await expect.poll(() => sheet.count()).toBe(0);
    await page.close();
  });

  it("draws the overview's charts, named, with their data as tables", async () => {
    const page = await browser().newPage({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "Europe/Oslo",
    });
    await openApp(page, BASE);
    for (const name of [
      "Consumption per day, March 2026 against March 2025",
      "Spot price in NO1 per quarter-hour, March 29, 2026",
      "Consumption and solar production per month, March 2025 to February 2026",
    ]) {
      expect(await page.getByRole("listbox", { name: new RegExp(name, "u") }).count(), name).toBe(1);
    }
    // March 2026 has bars for its 28 read days, and March 2025 for all 31.
    await expect.poll(() => page.locator('[data-slot="chart-bar"]').count()).toBeGreaterThan(0);
    const daily = page.locator('[data-slot="chart"]').first();
    await daily.getByRole("button", { name: "Show as table" }).click();
    expect(await daily.locator('[data-slot="chart-table"] tbody tr').count()).toBe(31);
    // Four key figures, each with its Sparkline.
    expect(await page.locator('[data-slot="sparkline"]').count()).toBe(4);
    await page.close();
  });

  it("narrows the metering points to the hand-counted rows, then to none", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/metering-points`);
    await expect.poll(() => pointsStatus(page).textContent()).toBe("480 metering points");
    await filterBy(page, "Price area", "NO4 Northern Norway");
    await expect.poll(() => pointsStatus(page).textContent()).toBe("48 metering points of 480");
    await filterBy(page, "Contract", "Fixed price");
    await expect.poll(() => pointsStatus(page).textContent()).toBe("24 metering points of 480");
    await filterBy(page, "Status", "Disconnected");
    await expect.poll(() => page.getByText("No metering points match").isVisible()).toBe(true);
    await page.getByRole("button", { name: "Clear search and filters" }).click();
    await expect.poll(() => pointsStatus(page).textContent()).toBe("480 metering points");
    await page.close();
  });

  it("finds one metering point by its GSRN", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/metering-points`);
    const [point] = METERING_POINTS;
    await page.getByRole("searchbox", { name: "Search metering points" }).fill(point?.id ?? "");
    await expect.poll(() => pointsStatus(page).textContent()).toBe("1 metering point of 480");
    await page.close();
  });

  it("sends a reading reminder from the keyboard, then keeps focus on the table", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/metering-points`);
    const rows = page.getByRole("checkbox", { name: /^Select .+, /u });
    for (const index of [0, 1, 2]) {
      await rows.nth(index).focus();
      await page.keyboard.press("Space");
    }
    const toolbar = page.getByRole("toolbar", { name: "Selected metering points" });
    await expect.poll(() => toolbar.getByRole("status").textContent()).toBe("3 points selected");
    await toolbar.getByRole("button", { name: "Send reading reminder" }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.getByText("Reading reminders sent").isVisible()).toBe(true);
    // The action clears the selection: the toolbar goes and the three rows are unticked.
    await expect.poll(() => toolbar.count()).toBe(0);
    for (const index of [0, 1, 2]) expect(await rows.nth(index).getAttribute("aria-checked")).toBe("false");
    // Focus moved to the select-all checkbox before the toolbar went, not to the body.
    expect(await activeSlot(page)).toBe("data-table-select-all");
    await page.close();
  });

  it("clears the selection from the keyboard, then keeps focus on the table", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/metering-points`);
    const rows = page.getByRole("checkbox", { name: /^Select .+, /u });
    await rows.first().focus();
    await page.keyboard.press("Space");
    const toolbar = page.getByRole("toolbar", { name: "Selected metering points" });
    await toolbar.getByRole("button", { name: "Clear selection" }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => toolbar.count()).toBe(0);
    expect(await rows.first().getAttribute("aria-checked")).toBe("false");
    expect(await activeSlot(page)).toBe("data-table-select-all");
    await page.close();
  });

  it("moves focus to the new page's title after Enter on a sidebar link, so Page Down scrolls the page", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, BASE);
    // The first load leaves focus to the browser.
    expect(await activeTitle(page)).toBeNull();
    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: /^Metering points/u })
      .focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => activeTitle(page)).toContain("Metering points");
    // Page Down scrolls the page's own scroller, not the document around it.
    await page.keyboard.press("PageDown");
    await expect
      .poll(() => page.locator("#app-content").evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    expect(await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)).toBe(0);
    // Tab starts in the page: the next stop is inside it.
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.querySelector("#app-content")?.contains(document.activeElement) === true
      )
    ).toBe(true);
    await page.close();
  });

  it("moves focus to the new page's title after a command-menu jump, not back to the header", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, BASE);
    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: "Search pages and actions" }).fill("Settings");
    await page.keyboard.press("Enter");
    await expect.poll(() => activeTitle(page)).toContain("Settings");
    // Still there once the menu's close has finished, which would otherwise refocus its trigger.
    await expect.poll(() => page.getByRole("dialog").count()).toBe(0);
    await page.waitForTimeout(400);
    expect(await activeTitle(page)).toContain("Settings");
    await page.close();
  });

  it("moves focus to the new page's title after a link in the phone's sidebar sheet", async () => {
    const page = await browser().newPage({ viewport: PHONE_VIEWPORT });
    await openApp(page, BASE);
    await page.getByRole("button", { name: "Toggle sidebar", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("link", { name: /^Invoices/u }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => activeTitle(page)).toContain("Invoices");
    // Still there once the sheet has closed, which would otherwise refocus the sidebar's trigger.
    await expect.poll(() => sheet.count()).toBe(0);
    await page.waitForTimeout(400);
    expect(await activeTitle(page)).toContain("Invoices");
    await page.close();
  });

  it("lets search and the filter bar hide selected points alike, and acts on the visible ones", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/metering-points`);
    const [first] = METERING_POINTS;
    const other = METERING_POINTS.find((point) => point.priceArea !== first?.priceArea);
    if (first === undefined || other === undefined) throw new Error("The portfolio has one price area.");
    const search = page.getByRole("searchbox", { name: "Search metering points" });
    const checkbox = page.getByRole("checkbox", { name: /^Select .+, /u }).first();
    const toolbar = page.getByRole("toolbar", { name: "Selected metering points" });
    const selection = toolbar.getByRole("status");
    // Select two points of different price areas, each found by its GSRN.
    await search.fill(first.id);
    await expect.poll(() => pointsStatus(page).textContent()).toBe("1 metering point of 480");
    await checkbox.click();
    await search.fill(other.id);
    await expect.poll(() => pointsStatus(page).textContent()).toBe("1 metering point of 480");
    await checkbox.click();
    // Search hides the first: it stays selected, out of the actions' reach.
    await expect.poll(() => selection.textContent()).toBe("1 point selected · 1 more hidden by filters");
    await search.fill("");
    await expect.poll(() => selection.textContent()).toBe("2 points selected");
    // A column filter hides the other the same way.
    await filterBy(page, "Price area", `${first.priceArea} ${PRICE_AREA_NAMES[first.priceArea]}`);
    await expect.poll(() => selection.textContent()).toBe("1 point selected · 1 more hidden by filters");
    // The action reaches the visible one only, which leaves the selection.
    await toolbar.getByRole("button", { name: "Send reading reminder" }).click();
    await expect
      .poll(() => page.getByText("1 customer will get a reminder to read their meter.").isVisible())
      .toBe(true);
    await expect.poll(() => selection.textContent()).toBe("0 points selected · 1 more hidden by filters");
    expect(await toolbar.getByRole("button", { name: "Send reading reminder" }).isDisabled()).toBe(true);
    // Lifting the filter shows the hidden one, still selected.
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect.poll(() => selection.textContent()).toBe("1 point selected");
    await search.fill(first.id);
    await expect.poll(() => checkbox.getAttribute("aria-checked")).toBe("false");
    await page.close();
  });

  it("shows the 6 overdue invoices, and opens and closes one", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/invoices`);
    await page.getByRole("button", { name: /^Overdue/u }).click();
    const openers = page
      .getByRole("table", { name: "Invoices" })
      .getByRole("button", { name: /^INV-2602-/u });
    await expect.poll(() => openers.count()).toBe(6);
    // The opener keeps the 24px target floor at the neutral theme's dense metrics.
    expect((await openers.first().boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
    const number = await openers.first().textContent();
    await openers.first().click();
    const sheet = page.getByRole("dialog", { name: number ?? "" });
    await expect.poll(() => sheet.isVisible()).toBe(true);
    // The sheet slides in from the side, and two box reads apart in time would see it at two
    // places, so the footer is measured once the slide has ended.
    await expect.poll(() => sheet.evaluate((popup) => popup.getAnimations({ subtree: true }).length)).toBe(0);
    // On desktop the footer is one row, Close first and the primary action last.
    const close = await sheet
      .getByRole("button", { name: "Close", exact: true })
      .filter({ hasText: "Close" })
      .boundingBox();
    const remind = await sheet.getByRole("button", { name: "Send reminder" }).boundingBox();
    expect(close !== null && remind !== null && Math.abs(close.y - remind.y) < 1 && close.x < remind.x).toBe(
      true
    );
    await page.keyboard.press("Escape");
    await expect.poll(() => sheet.count()).toBe(0);
    await page.close();
  });

  it("validates the settings, and focuses the first field to fix", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/settings`);
    const name = page.getByRole("textbox", { name: "Full name" });
    const email = page.getByRole("textbox", { name: "Email" });
    await name.fill("");
    await email.fill("nope");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect.poll(() => name.getAttribute("aria-invalid")).toBe("true");
    expect(await name.evaluate((element) => element === document.activeElement)).toBe(true);
    expect(await page.getByText("Enter your name.").isVisible()).toBe(true);
    expect(await page.getByText("Enter an email address such as name@example.com.").isVisible()).toBe(true);
    expect(await page.getByText("Settings saved").count()).toBe(0);
    await page.close();
  });

  it("saves every setting in one submission, and Discard returns to what was saved", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}/settings`);
    const status = page.getByRole("status").filter({ hasText: /changes/u });
    const contract = page.getByRole("combobox", { name: "Default contract" });
    expect(await status.textContent()).toBe("All changes saved");
    await page.getByRole("textbox", { name: "Email" }).fill("kari@example.com");
    await contract.click();
    await page.getByRole("option", { name: "Fixed price" }).click();
    await page.getByRole("radio", { name: "30 days" }).click();
    await page.getByRole("switch", { name: "Weekly report" }).click();
    await page.getByRole("textbox", { name: "Alert threshold, øre/kWh" }).fill("120");
    expect(await status.textContent()).toBe("Unsaved changes");
    await page.getByRole("button", { name: "Save settings" }).click();
    // The toast reads back what was saved, every field of it.
    await expect
      .poll(() =>
        page
          .getByText(
            "Fixed price by default, 30-day terms, price alerts above 120 øre/kWh and a weekly report."
          )
          .isVisible()
      )
      .toBe(true);
    await expect.poll(() => status.textContent()).toBe("All changes saved");
    // Change it again, then discard: the form returns to the saved settings, not to the defaults.
    await contract.click();
    await page.getByRole("option", { name: "Variable" }).click();
    await page.getByRole("radio", { name: "14 days" }).click();
    await page.getByRole("switch", { name: "Weekly report" }).click();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect.poll(() => contract.textContent()).toContain("Fixed price");
    expect(await page.getByRole("radio", { name: "30 days" }).getAttribute("aria-checked")).toBe("true");
    expect(await page.getByRole("switch", { name: "Weekly report" }).getAttribute("aria-checked")).toBe(
      "true"
    );
    expect(await page.getByRole("textbox", { name: "Alert threshold, øre/kWh" }).inputValue()).toBe("120");
    expect(await page.getByRole("textbox", { name: "Email" }).inputValue()).toBe("kari@example.com");
    expect(await status.textContent()).toBe("All changes saved");
    await page.close();
  });

  it.each([
    { theme: "neutral-fkas-private", face: "--font-inter" },
    { theme: "branded-tkas-company", face: "--font-roboto" },
  ])("draws the $theme theme's face, $face", async ({ theme, face }) => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    await openApp(page, `${BASE}?theme=${theme}`);
    expect(await drawnFace(page.getByRole("heading", { level: 1 }))).toBe(face);
    await page.close();
  });

  it("keeps the theme a new tab was opened with, through hydration and across its pages", async () => {
    const page = await browser().newPage({ viewport: DESKTOP_VIEWPORT });
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "warning" || message.type() === "error") warnings.push(message.text());
    });
    // Every write to <html>'s theme and density attributes from the first script on, hydration's
    // included, with the value each write replaced. The init script runs before the parser has
    // made even <html>, so it watches the whole document.
    await page.addInitScript(() => {
      const log: { name: string; old: string | null }[] = [];
      new MutationObserver((records) => {
        for (const record of records) {
          if (record.target === document.documentElement && record.attributeName !== null) {
            log.push({ name: record.attributeName, old: record.oldValue });
          }
        }
        sessionStorage.setItem("theme-writes", JSON.stringify(log));
      }).observe(document, {
        subtree: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-theme-brand", "data-theme-identity", "data-theme-segment", "data-density"],
      });
    });
    await openApp(page, `${BASE}?theme=branded-tkas-company`);
    await page.waitForTimeout(300);
    const root = page.locator("html");
    const log = await page.evaluate(() => sessionStorage.getItem("theme-writes") ?? "[]");
    // SAFETY: the init script above wrote this JSON, an array of { name, old } entries.
    const writes = JSON.parse(log) as { name: string; old: string | null }[];
    /** Every value written to one attribute, in order: each write's value is the next one's old. */
    const written = async (name: string) => [
      ...writes
        .filter((write) => write.name === name)
        .slice(1)
        .map((write) => write.old),
      await root.getAttribute(name),
    ];
    // The server stamps the default theme, Fjordkraft · Private · Neutral at dense metrics. From the
    // head script's first write on, no write puts any of it back.
    expect(writes.filter((write) => write.name === "data-theme-brand").length).toBeGreaterThan(0);
    expect(new Set(await written("data-theme-brand"))).toEqual(new Set(["tkas"]));
    expect(new Set(await written("data-theme-identity"))).toEqual(new Set(["branded"]));
    expect(new Set(await written("data-theme-segment"))).toEqual(new Set(["company"]));
    expect(new Set(await written("data-density"))).toEqual(new Set(["comfortable"]));
    expect(warnings.filter((text) => /does not match document brand attributes/u.test(text))).toEqual([]);
    // A link drops the query, and the theme stays.
    await page
      .locator('[data-slot="sidebar"]')
      .getByRole("link", { name: /^Invoices/u })
      .click();
    await expect.poll(() => heading(page)).toBe("Invoices");
    expect(new URL(page.url()).search).toBe("");
    expect(await root.getAttribute("data-theme-brand")).toBe("tkas");
    expect(await root.getAttribute("data-theme-segment")).toBe("company");
    expect(await root.getAttribute("data-theme-identity")).toBe("branded");
    expect(await root.getAttribute("data-density")).toBe("comfortable");
    await page.close();
  });
});

describe("the app shell block on its docs page", () => {
  it("frames the preview at the header's theme, and follows the picker", async () => {
    const page = await browser().newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/blocks/app-shell`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.frameLocator('iframe[title="App shell preview"]');
    const root = frame.locator("html");
    const title = frame.getByRole("heading", { level: 1 });
    // The docs' default preview theme, Fjordkraft · Private · Neutral.
    await expect.poll(() => root.getAttribute("data-theme-brand")).toBe("fkas");
    expect(await drawnFace(title)).toBe("--font-inter");
    await page.getByRole("button", { name: "Theme settings", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "TrøndelagKraft", exact: true }).click();
    await expect.poll(() => root.getAttribute("data-theme-brand")).toBe("tkas");
    await page.getByRole("menuitemradio", { name: "Branded", exact: true }).click();
    await expect.poll(() => root.getAttribute("data-theme-identity")).toBe("branded");
    // The variant picks the density, as on the docs' demo stages.
    await expect.poll(() => root.getAttribute("data-density")).toBe("comfortable");
    await expect.poll(() => drawnFace(title)).toBe("--font-roboto");
    await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
    await expect.poll(() => root.getAttribute("data-theme")).toBe("dark");
    await page.close();
  });

  it("lays the block out at the phone's width and back at desktop", async () => {
    const page = await browser().newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/blocks/app-shell`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const frame = page.frameLocator('iframe[title="App shell preview"]');
    await expect
      .poll(() => frame.getByRole("button", { name: "Toggle sidebar", exact: true }).count())
      .toBe(1);
    await page.getByRole("button", { name: "Phone", exact: true }).click();
    await expect.poll(() => frame.locator("html").evaluate(() => window.innerWidth)).toBe(390);
    // At 390px the sidebar is a Sheet, so its links are out of the layout until opened.
    await expect.poll(() => frame.getByRole("link", { name: /^Invoices/u }).isVisible()).toBe(false);
    await page.getByRole("button", { name: "Desktop", exact: true }).click();
    await expect
      .poll(() => frame.locator("html").evaluate(() => window.innerWidth))
      .toBeGreaterThanOrEqual(1024);
    await page.close();
  });

  it("reloads the preview on its current route, and never moves the docs page", async () => {
    const page = await browser().newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/blocks/app-shell`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const docsUrl = page.url();
    const frame = page.frameLocator('iframe[title="App shell preview"]');
    const sidebar = frame.locator('[data-slot="sidebar"]');
    const address = (path: string) => page.getByText(path, { exact: true });
    // The chrome has no back or forward of its own: the browser's own step through the iframe.
    expect(await page.getByRole("button", { name: "Back", exact: true }).count()).toBe(0);
    expect(await page.getByRole("button", { name: "Forward", exact: true }).count()).toBe(0);
    await sidebar.getByRole("link", { name: /^Metering points/u }).click();
    await expect.poll(() => address(`${BASE}/metering-points`).count()).toBe(1);
    await sidebar.getByRole("link", { name: /^Invoices/u }).click();
    await expect.poll(() => address(`${BASE}/invoices`).count()).toBe(1);
    expect(page.url()).toBe(docsUrl);
    // A mark on the current document, which a real reload drops with the document.
    const root = frame.locator("html");
    await root.evaluate((element) => element.setAttribute("data-before-reload", ""));
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await expect.poll(() => root.getAttribute("data-before-reload")).toBeNull();
    // The reloaded document reports its route again, and its heading is the same page's.
    await expect.poll(() => frame.getByRole("heading", { level: 1 }).textContent()).toBe("Invoices");
    await expect.poll(() => address(`${BASE}/invoices`).count()).toBe(1);
    expect(page.url()).toBe(docsUrl);
    await page.close();
  });

  it("gives the On this page column and the prose measure back on the next page", async () => {
    const page = await browser().newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/blocks/app-shell`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    const quickNav = page.getByRole("navigation", { name: "On this page" });
    const main = page.locator("main#main-content");
    expect(await quickNav.count()).toBe(0);
    expect((await main.boundingBox())?.width ?? 0).toBeGreaterThan(720);
    // A client navigation, which keeps the block's page mounted in a hidden Activity boundary.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Button", exact: true })
      .click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/components/button");
    await expect.poll(() => quickNav.isVisible()).toBe(true);
    expect((await main.boundingBox())?.width ?? 0).toBeLessThanOrEqual(720);
    await page.close();
  });

  it("shows each file's source in the Code view", async () => {
    const page = await browser().newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(5000);
    await page.goto(`${docsBaseUrl()}/blocks/app-shell`, { waitUntil: "load" });
    await waitForDocsShellHydration(page);
    await page.getByRole("tab", { name: "Code", exact: true }).click();
    const files = page.getByRole("navigation", { name: "Files" });
    await files.getByRole("button", { name: "power-data.ts", exact: true }).click();
    expect(await files.getByRole("button", { name: "power-data.ts" }).getAttribute("aria-current")).toBe(
      "true"
    );
    const panel = page.getByRole("region", { name: "power-data.ts source" });
    await expect.poll(() => panel.getByText("export const METERING_POINT_COUNT = 480;").count()).toBe(1);
    // The highlighted markup arrives from the prerendered source route.
    await expect.poll(() => panel.locator(".sh__line").count()).toBeGreaterThan(100);
    await page.close();
  });
});
