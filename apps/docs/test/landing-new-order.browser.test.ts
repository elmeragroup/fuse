import type { Locator } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, expectInside } from "./demo-page";
import { OPEN_COUNTS, dashboard, row } from "./landing-dashboard";
import { launchLandingSuite } from "./landing-page";

const { openLanding } = launchLandingSuite();

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
  await sheet.getByLabel("Start date").fill("2026-10-20");
  await sheet.getByRole("checkbox", { name: /power of attorney/u }).click();
}

describe("landing Dashboard New order", () => {
  it("saves a filled New order as a draft in Drafts", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await app.getByRole("button", { name: /^New order/u }).click();
    const sheet = page.getByRole("dialog", { name: "New order" });
    await sheet.waitFor();
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

  it("shows each field's error on an empty New order submit and saves nothing", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    const drafts = OPEN_COUNTS.Drafts;
    await app.getByRole("button", { name: /^New order/u }).click();
    const sheet = page.getByRole("dialog", { name: "New order" });
    await sheet.getByRole("button", { name: "Save draft" }).click();

    await expect
      .poll(async () => sheet.getByRole("alert").allTextContents())
      .toEqual([
        "Enter the customer's name.",
        "Enter all 11 digits.",
        "Enter the full phone number, including the country code.",
        "Enter an email address, such as navn@eksempel.no.",
        "Enter the facility's address.",
        "A Norwegian metering point ID has 18 digits and starts with 7070.",
        // nb-NO groups thousands with a no-break space.
        "Enter an estimate between 500 kWh and 100\u00a0000 kWh.",
        "Pick a start date from today on.",
        "The customer must give power of attorney first.",
      ]);
    expect(await sheet.getByLabel("Name", { exact: true }).getAttribute("aria-invalid")).toBe("true");
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
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await app.getByRole("button", { name: /^New order/u }).click();
    const sheet = page.getByRole("dialog", { name: "New order" });
    await sheet.waitFor();
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
});
