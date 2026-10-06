import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, expectInside } from "./demo-page";
import {
  OPEN_COUNTS,
  dashboard,
  expectBeside,
  openNewOrder,
  row,
  windowScope,
  DASHBOARD_FIRST,
} from "./landing-dashboard";
import { holdChunks, launchLandingSuite, settleFrames } from "./landing-page";
import type { HeldChunks } from "./landing-page";

const { openLanding } = launchLandingSuite({ search: DASHBOARD_FIRST });

/** The error Start date shows for a missing or past date. */
const START_DATE_ERROR = "Pick a start date from today on.";

/** The alerts an empty New order raises, one per field, in form order. */
const EMPTY_ALERTS = [
  "Enter the customer's name.",
  "Enter all 11 digits.",
  "Enter the full phone number, including the country code.",
  "Enter an email address, such as navn@eksempel.no.",
  "Enter the facility's address.",
  "A Norwegian metering point ID has 18 digits and starts with 7070.",
  // nb-NO groups thousands with a no-break space.
  "Enter an estimate between 500 kWh and 100\u00a0000 kWh.",
  START_DATE_ERROR,
  "The customer must give power of attorney first.",
] as const;

/** The Start date picker's field: a group of day, month and year segments, in nb-NO order. */
function startDate(sheet: Locator): Locator {
  return sheet.getByRole("group", { name: "Start date" });
}

/** Types `digits` into Start date's segments from the keyboard, starting at the day. */
async function typeStartDate(sheet: Locator, digits: string): Promise<void> {
  await startDate(sheet).getByRole("spinbutton").first().click();
  await sheet.page().keyboard.type(digits);
}

/** The day segment's nb-NO placeholder, shown while the day is empty. */
const START_DAY_PLACEHOLDER = "dd";

/**
 * Empties Start date's day from the keyboard. Backspace drops one digit at a time, so "20" passes
 * through "02", a complete date the picker commits, before the day reads its placeholder.
 */
async function clearStartDay(sheet: Locator): Promise<void> {
  await startDate(sheet).getByRole("spinbutton").first().click();
  await sheet.page().keyboard.press("Backspace");
  await sheet.page().keyboard.press("Backspace");
  expect(await startDateText(sheet)).toEqual([START_DAY_PLACEHOLDER, "10", "2026"]);
}

/** The Start date segments' text, as the field shows it. */
async function startDateText(sheet: Locator): Promise<string[]> {
  return startDate(sheet).getByRole("spinbutton").allTextContents();
}

/** The Note for back office textarea, found by its role and visible label. */
function noteField(sheet: Locator): Locator {
  return sheet.getByRole("textbox", { name: "Note for back office" });
}

/** Opens a New order Sheet in a landing scrolled to the window. */
async function openScrolledNewOrder(page: Page): Promise<{ app: Locator; sheet: Locator }> {
  const app = dashboard(page);
  await app.scrollIntoViewIfNeeded();
  return { app, sheet: await openNewOrder(app) };
}

/** Fills every New order field validly for Turid Fjellheim, with `phone` typed as given. */
async function fillNewOrder(sheet: Locator, phone: string): Promise<void> {
  await sheet.getByLabel("Name", { exact: true }).fill("Turid Fjellheim");
  await sheet.getByLabel("SSN").fill("24076512345");
  await sheet.getByRole("textbox", { name: "Phone" }).fill(phone);
  await sheet.getByLabel("Email").fill("turid@eksempel.no");
  await sheet.getByLabel("Facility address").fill("Fjordgata 2, 7010 Trondheim");
  await sheet.getByLabel("Metering point ID").fill("707057500012345678");
  await sheet.getByLabel("Estimated annual use").fill("16000");
  await sheet.getByRole("radio", { name: /^StrømSmart\+/u }).click();
  await sheet.getByRole("combobox", { name: "Campaign" }).click();
  await sheet.page().getByRole("option", { name: "Høstkampanje" }).click();
  await sheet.getByRole("radio", { name: "Move" }).click();
  // The demo's today is 2 October 2026, so 20 October is a valid start.
  await typeStartDate(sheet, "20102026");
  await sheet.getByRole("checkbox", { name: /power of attorney/u }).click();
}

describe("landing Dashboard New order", () => {
  it("opens before its form's code arrives, holds the body with a loader, and stays closed once Escape closes it", async () => {
    let held: HeldChunks | undefined;
    const page = await openLanding(DESKTOP_VIEWPORT, {
      prepare: async (target) => {
        // Only the form's code renders the Note for back office label.
        held = await holdChunks(target, "Note for back office");
      },
    });
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await app.getByRole("button", { name: /^New order/u }).click();
    const sheet = page.getByRole("dialog", { name: "New order" });
    await sheet.getByRole("status", { name: "Loading the form" }).waitFor();
    const caught = held?.caught() ?? [];
    expect(caught).toHaveLength(1);

    await page.keyboard.press("Escape");
    await expect.poll(async () => sheet.count()).toBe(0);
    const delivered = page.waitForEvent("requestfinished", (request) => caught.includes(request.url()));
    held?.release();
    await delivered;
    await settleFrames(page);
    expect(await sheet.count()).toBe(0);

    const reopened = await openNewOrder(app);
    expect(await reopened.getByRole("status", { name: "Loading the form" }).count()).toBe(0);
    await page.context().close();
  });

  it("names every New order control by its role and visible label", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { sheet } = await openScrolledNewOrder(page);
    const named = [
      ["textbox", "Name"],
      ["textbox", "SSN"],
      ["button", "Select country"],
      ["textbox", "Phone"],
      ["textbox", "Email"],
      ["textbox", "Facility address"],
      ["textbox", "Metering point ID"],
      ["textbox", "Estimated annual use"],
      ["button", "Decrease"],
      ["button", "Increase"],
      ["radiogroup", "Product"],
      ["combobox", "Campaign"],
      ["radiogroup", "Startup"],
      ["group", "Start date"],
      ["checkbox", "The customer gives power of attorney to change supplier"],
      ["textbox", "Note for back office"],
      ["button", "Cancel"],
      ["button", "Save draft"],
    ] as const;
    for (const [role, name] of named) {
      expect(await sheet.getByRole(role, { name, exact: true }).count(), `${role} "${name}"`).toBe(1);
    }
    await page.context().close();
  });

  it("saves a filled New order as a draft in Drafts", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { app, sheet } = await openScrolledNewOrder(page);
    await expectInside(sheet, app);

    await fillNewOrder(sheet, "912 34 567");
    await sheet.getByRole("button", { name: "Save draft" }).click();

    await expect.poll(async () => sheet.count()).toBe(0);
    await row(app, "Turid Fjellheim").waitFor();
    expect(await app.getByRole("button", { name: "Drafts", exact: true }).getAttribute("aria-current")).toBe(
      "page"
    );
    const detail = app.getByRole("complementary", { name: "Order details" });
    expect(await detail.getByRole("heading", { level: 2 }).textContent()).toBe("Turid Fjellheim");
    expect(await detail.getByText("StrømSmart+ · Høstkampanje").count()).toBe(1);
    expect(await detail.getByText("+4791234567 · turid@eksempel.no").count()).toBe(1);
    await app.getByRole("region", { name: "Dashboard notifications" }).getByText("Draft saved").waitFor();
    await page.context().close();
  });

  it("shows each field's error on an empty New order submit, clears only the power-of-attorney error once its box is checked, and saves nothing", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const drafts = OPEN_COUNTS.Drafts;
    const { app, sheet } = await openScrolledNewOrder(page);
    await sheet.getByRole("button", { name: "Save draft" }).click();

    await expect.poll(async () => sheet.getByRole("alert").allTextContents()).toEqual(EMPTY_ALERTS);
    expect(await sheet.getByLabel("Name", { exact: true }).getAttribute("aria-invalid")).toBe("true");

    await sheet.getByRole("checkbox", { name: /power of attorney/u }).click();
    await expect
      .poll(async () => sheet.getByRole("alert").allTextContents())
      .toEqual(
        EMPTY_ALERTS.filter((message) => message !== "The customer must give power of attorney first.")
      );
    await page.keyboard.press("Escape");
    await expect.poll(async () => sheet.count()).toBe(0);
    // DOM audit: Sidebar.MenuBadge is a sibling of the entry's button and has no role.
    const badge = app
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "Drafts", exact: true }) })
      .locator("[data-slot='sidebar-menu-badge']");
    expect(await badge.textContent()).toBe(drafts);
    await page.context().close();
  });

  it("shows the phone error when New order is submitted with only the country prefix, and saves nothing", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { app, sheet } = await openScrolledNewOrder(page);
    await fillNewOrder(sheet, "+47");
    await sheet.getByRole("button", { name: "Save draft" }).click();

    await expect
      .poll(async () => sheet.getByRole("alert").allTextContents())
      .toEqual(["Enter the full phone number, including the country code."]);
    await page.keyboard.press("Escape");
    await expect.poll(async () => sheet.count()).toBe(0);
    expect(await row(app, "Turid Fjellheim").count()).toBe(0);
    await page.context().close();
  });

  it("fills Start date from a day picked in its calendar, which opens beside the field and offers no past day", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { app, sheet } = await openScrolledNewOrder(page);
    await startDate(sheet).getByRole("button", { name: "Kalender" }).click();
    const calendar = page.getByRole("dialog").filter({ has: page.getByRole("grid") });
    await calendar.waitFor();

    await expectBeside(calendar, startDate(sheet), windowScope(app));
    // The demo's today is Friday 2 October 2026: the 1st is past, so it takes no pick.
    expect(await calendar.getByRole("heading").textContent()).toBe("oktober 2026");
    expect(
      await calendar.getByRole("button", { name: /\b1\. oktober 2026/u }).getAttribute("aria-disabled")
    ).toBe("true");
    await calendar.getByRole("button", { name: /\b20\. oktober 2026/u }).click();

    await expect.poll(async () => calendar.count()).toBe(0);
    expect(await startDateText(sheet)).toEqual(["20", "10", "2026"]);
    await page.context().close();
  });

  it("takes Start date by segment from the keyboard, flags a past date on submit and clears the error once it is fixed", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { sheet } = await openScrolledNewOrder(page);
    await fillNewOrder(sheet, "912 34 567");
    await typeStartDate(sheet, "01102026");
    expect(await startDateText(sheet)).toEqual(["01", "10", "2026"]);
    await sheet.getByRole("button", { name: "Save draft" }).click();

    await expect.poll(async () => sheet.getByRole("alert").allTextContents()).toEqual([START_DATE_ERROR]);
    // The demo's today is the first day it takes.
    await typeStartDate(sheet, "02102026");
    await expect.poll(async () => sheet.getByRole("alert").allTextContents()).toEqual([]);
    await page.context().close();
  });

  it("keeps a cleared Start date day cleared while another field is edited, flags it on submit and saves nothing", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { app, sheet } = await openScrolledNewOrder(page);
    await fillNewOrder(sheet, "912 34 567");
    await clearStartDay(sheet);

    // A new value, so the edit renders the form again.
    await sheet.getByLabel("Name", { exact: true }).fill("Turid Fjellheim Berg");
    expect(await startDateText(sheet)).toEqual([START_DAY_PLACEHOLDER, "10", "2026"]);
    await sheet.getByRole("button", { name: "Save draft" }).click();

    await expect.poll(async () => sheet.getByRole("alert").allTextContents()).toEqual([START_DATE_ERROR]);
    expect(await row(app, "Turid Fjellheim").count()).toBe(0);
    await page.context().close();
  });

  it("saves the date React Aria constrains a Start date day past the month's end to on blur", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const { app, sheet } = await openScrolledNewOrder(page);
    await fillNewOrder(sheet, "912 34 567");
    await typeStartDate(sheet, "20112026");
    await typeStartDate(sheet, "31");

    await noteField(sheet).click();

    // Oracle: November has 30 days, and React Aria constrains the day to the month on blur.
    expect(await startDateText(sheet)).toEqual(["30", "11", "2026"]);
    await sheet.getByRole("button", { name: "Save draft" }).click();
    await expect.poll(async () => sheet.count()).toBe(0);
    const detail = app.getByRole("complementary", { name: "Order details" });
    await detail.getByText("StrømSmart+ for Turid Fjellheim, move from 30 Nov").waitFor();
    await page.context().close();
  });
});
