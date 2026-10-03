import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import {
  dashboard,
  expectBeside,
  openNewOrder,
  openOrderSearch,
  row,
  scrollWindowPartWay,
  windowScope,
} from "./landing-dashboard";
import { launchLandingSuite } from "./landing-page";

const { openLanding } = launchLandingSuite();

/** The widths the visitor reported the misplaced popups at, and a common laptop width. */
const VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
] as const;

/** Opens the landing at `viewport` with the window scrolled part way up, and returns it. */
async function openScrolled(viewport: (typeof VIEWPORTS)[number]): Promise<{ page: Page; app: Locator }> {
  const page = await openLanding(viewport);
  await scrollWindowPartWay(page);
  return { page, app: dashboard(page) };
}

/** Opens a menu from `trigger`, expects it beside the trigger, and closes it. */
async function expectMenuBeside(page: Page, app: Locator, trigger: Locator): Promise<void> {
  await trigger.click();
  await expectBeside(page.getByRole("menu"), trigger, windowScope(app));
  await page.keyboard.press("Escape");
  await expect.poll(async () => page.getByRole("menu").count()).toBe(0);
}

describe.each(VIEWPORTS)("landing Dashboard overlays at $width×$height, scrolled", (viewport) => {
  it("opens the Campaign list right under its trigger, aligned with it", async () => {
    const { page, app } = await openScrolled(viewport);
    const sheet = await openNewOrder(app);
    const trigger = sheet.getByRole("combobox", { name: "Campaign" });
    await trigger.click();
    const list = page.getByRole("listbox");

    await expect
      .poll(async () => {
        const [l, t] = await Promise.all([list.boundingBox(), trigger.boundingBox()]);
        if (l === null || t === null) {
          return null;
        }
        const gap = Math.round(l.y - (t.y + t.height));
        return { gap, under: gap >= 0 && gap <= 8, left: Math.round(l.x - t.x) };
      })
      .toMatchObject({ under: true, left: 0 });
    await expectBeside(list, trigger, windowScope(app));
    await page.context().close();
  });

  it("fills the window's right edge with the New order Sheet and covers the window with its backdrop, with Campaign open", async () => {
    const { page, app } = await openScrolled(viewport);
    const sheet = await openNewOrder(app);
    await sheet.getByRole("combobox", { name: "Campaign" }).click();
    await page.getByRole("listbox").waitFor();
    const scope = windowScope(app);
    // DOM audit: the Sheet's backdrop is presentational and has no role.
    const backdrop = app.locator("[data-slot='sheet-overlay']");

    await expect
      .poll(async () => {
        const [s, b, w] = await Promise.all([
          sheet.boundingBox(),
          backdrop.boundingBox(),
          scope.boundingBox(),
        ]);
        return s === null || b === null || w === null
          ? null
          : {
              sheetRight: Math.round(s.x + s.width - (w.x + w.width)),
              backdrop: [b.x - w.x, b.y - w.y, b.width - w.width, b.height - w.height].map(Math.round),
            };
      })
      .toEqual({ sheetRight: 0, backdrop: [0, 0, 0, 0] });
    await page.context().close();
  });

  it("opens the status menu, More actions and the seller menu beside their triggers", async () => {
    const { page, app } = await openScrolled(viewport);
    await row(app, "Jonas Eide").click();
    // The detail is a pane beside the list or, where the window is narrow, a Sheet inside it.
    const detail = page
      .getByRole("complementary", { name: "Order details" })
      .or(page.getByRole("dialog", { name: "Jonas Eide" }));

    await expectMenuBeside(page, app, detail.getByRole("button", { name: /^Status:/u }));
    await expectMenuBeside(page, app, detail.getByRole("button", { name: "More actions" }));
    await page.keyboard.press("Escape");
    await expectMenuBeside(page, app, app.getByRole("button", { name: /^Signed in as/u }));
    await page.context().close();
  });

  it("opens Order search's facet menus beside their triggers", async () => {
    const page = await openLanding(viewport);
    const app = await openOrderSearch(page);
    await scrollWindowPartWay(page);
    const search = app.getByRole("search", { name: "Order search" });

    for (const facet of ["Status", "Sales channel"]) {
      await expectMenuBeside(page, app, search.getByRole("button", { name: new RegExp(`^${facet}`, "u") }));
    }
    await page.context().close();
  });

  it("opens Order search's Rows per page list beside its trigger", async () => {
    const page = await openLanding(viewport);
    const app = await openOrderSearch(page);
    await scrollWindowPartWay(page);
    const trigger = app.getByRole("combobox", { name: "Rows per page" });
    // Base UI drops item alignment by itself near a viewport edge, so the trigger sits mid-way.
    await trigger.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    await trigger.click();

    await expectBeside(page.getByRole("listbox"), trigger, windowScope(app));
    await page.context().close();
  });

  it("opens the Start date calendar inside the window when the field sits low in the viewport", async () => {
    const { page, app } = await openScrolled(viewport);
    const sheet = await openNewOrder(app);
    const field = sheet.getByRole("group", { name: "Start date" });
    // Centred, the field leaves less room under it in the window than the calendar needs.
    await field.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    await field.getByRole("button", { name: "Kalender" }).click();
    const calendar = page.getByRole("dialog").filter({ has: page.getByRole("grid") });
    await calendar.waitFor();

    // Oracle: the window's clipping box. Any part of the calendar past it is cut off.
    await expectBeside(calendar, field, windowScope(app));
    await page.context().close();
  });

  it("opens the Change seller list beside its field", async () => {
    const { page, app } = await openScrolled(viewport);
    await app.getByRole("checkbox", { name: "Select Jonas Eide" }).click();
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).click();
    await app
      .getByRole("toolbar", { name: "Bulk actions" })
      .getByRole("button", { name: "Change seller" })
      .click();
    const field = page
      .getByRole("dialog", { name: "Change seller" })
      .getByRole("combobox", { name: "Seller" });
    await field.click();

    await expectBeside(page.getByRole("listbox"), field, windowScope(app));
    await page.context().close();
  });
});
