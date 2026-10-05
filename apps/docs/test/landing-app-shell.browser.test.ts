import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { resolveThemeCatalog } from "@elmeragroup/fuse/theme-catalog";

import { DESKTOP_VIEWPORT, expectInside } from "./demo-page";
import {
  IDA_METER_POINT,
  OPEN_COUNTS,
  PHONE_VIEWPORT,
  WIDE_VIEWPORT,
  dashboard,
  focusedCustomer,
  openNewOrder,
  openOrderSearch,
  row,
  DASHBOARD_FIRST,
} from "./landing-dashboard";
import { auditTargets, collectPageErrors, expectTargets, launchLandingSuite } from "./landing-page";

const { openLanding } = launchLandingSuite({ search: DASHBOARD_FIRST });

/** The md control height in px at the default 16px root, per density, as Fuse's metrics table states it. */
const CONTROL_MD = (() => {
  const metric = resolveThemeCatalog().density.find((entry) => entry.name === "control-h-md");
  if (metric === undefined) {
    throw new Error("The theme catalog has no control-h-md metric.");
  }
  return metric.px;
})();

/**
 * The window opens on My orders with open work only, grouped by status. These are the
 * signed-in seller's open orders as the fixture states them, newest first inside each group:
 * the test's own copy, so a data change that reorders the list fails here instead of passing.
 */
const MY_OPEN_ORDERS = [
  "Marius Kvam",
  "Camilla Røed",
  "Ahmed Hassan",
  "Ingvild Sandvik",
  "Jonas Eide",
  "Kjersti Holm",
  "Emil Solheim",
  "Oskar Lindberg",
  "Magnus Dahl",
  "Maja Johansen",
  "Ida Hagen",
  "Erlend Bø",
  "Ola Nordmann",
  "Tiril Aune",
  "Silje Nygård",
  "Knut Rasmussen",
  "Hilde Moe",
  "Sverre Nilsen",
  "Amalie Berntsen",
  "Jørgen Tangen",
  "Eline Haug",
  "Rune Solberg",
  "Synnøve Lien",
  "Tone Gulbrandsen",
  "Kristoffer Wang",
  "Mona Isaksen",
] as const;

/** Every sidebar entry that lists orders in a queue; Order search is a table. */
const QUEUES = [
  "Inbox",
  "My orders",
  "Drafts",
  "Sent",
  "Establishment stopped",
  "Errors",
  "Deviations",
] as const;

async function rowNames(scope: Locator): Promise<string[]> {
  const names = await scope
    .getByRole("list", { name: "Orders" })
    .getByRole("button", { name: /^\p{Lu}/u })
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-customer") ?? ""));
  return names;
}

/** Opens a sidebar entry and waits for its simulated fetch to finish. */
async function openView(page: Page, label: string): Promise<void> {
  const app = dashboard(page);
  await app.getByRole("button", { name: label, exact: true }).click();
  await expect.poll(async () => app.getByRole("status", { name: "Loading orders" }).count()).toBe(0);
  await app.getByRole("list", { name: "Orders" }).waitFor();
}

describe("landing Dashboard window", () => {
  it("drives the detail pane from a row click", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const detail = app.getByRole("complementary", { name: "Order details" });

    await row(app, "Ola Nordmann").click();

    expect(await detail.getByRole("heading", { level: 2 }).textContent()).toBe("Ola Nordmann");
    expect(await row(app, "Ola Nordmann").getAttribute("aria-current")).toBe("true");
    expect(await row(app, "Jonas Eide").getAttribute("aria-current")).toBe("false");
    await page.context().close();
  });

  it("moves with j and k only while focus is inside the window, and selects with Enter", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const detail = app.getByRole("complementary", { name: "Order details" });
    expect(await rowNames(app)).toEqual([...MY_OPEN_ORDERS]);

    // Outside the window the page keeps its keys: j moves nothing into the window.
    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("j");
    expect(await focusedCustomer(page)).toBeNull();

    await row(app, MY_OPEN_ORDERS[0]).focus();
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    expect(await focusedCustomer(page)).toBe(MY_OPEN_ORDERS[2]);
    await page.keyboard.press("k");
    expect(await focusedCustomer(page)).toBe(MY_OPEN_ORDERS[1]);
    await page.keyboard.press("Enter");
    expect(await detail.getByRole("heading", { level: 2 }).textContent()).toBe(MY_OPEN_ORDERS[1]);
    await page.context().close();
  });

  it("moves an order to its new status group when its status changes", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const detail = app.getByRole("complementary", { name: "Order details" });
    const inGroup = (group: string) =>
      app.getByRole("list", { name: group, exact: true }).getByRole("button", { name: /^Jonas Eide/u });

    expect(await inGroup("Awaiting customer approval").count()).toBe(1);
    await row(app, "Jonas Eide").click();
    await detail.getByRole("button", { name: /^Status/u }).click();
    await page.getByRole("menuitemradio", { name: "In progress" }).click();

    await expect.poll(async () => inGroup("In progress").count()).toBe(1);
    expect(await inGroup("Awaiting customer approval").count()).toBe(0);
    await app
      .getByRole("region", { name: "Dashboard notifications" })
      .getByText("Moved to In progress")
      .waitFor();
    await page.context().close();
  });

  it("starts another order's comment composer empty and logs nothing on the first", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const detail = app.getByRole("complementary", { name: "Order details" });
    const composer = detail.getByRole("textbox", { name: "Comment" });
    const note = "Kunden ringer tilbake etter klokka 16";

    await row(app, "Jonas Eide").click();
    await composer.fill(note);
    await row(app, "Ida Hagen").click();
    await expect.poll(async () => detail.getByRole("heading", { level: 2 }).textContent()).toBe("Ida Hagen");
    expect(await composer.inputValue()).toBe("");

    await row(app, "Jonas Eide").click();
    await expect.poll(async () => detail.getByRole("heading", { level: 2 }).textContent()).toBe("Jonas Eide");
    expect(await detail.getByText(note).count()).toBe(0);
    await page.context().close();
  });

  it("keeps the metering point and its copy button inside the detail Sheet at 320px", async () => {
    const page = await openLanding({ width: 320, height: 720 });
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();

    await row(app, "Ida Hagen").click();
    const detail = page.getByRole("dialog", { name: "Ida Hagen" });
    await detail.waitFor();
    const copy = detail.getByRole("button", { name: "Copy meter point ID" });
    await copy.scrollIntoViewIfNeeded();
    // DOM audit: the ScrollArea viewport is the Sheet's visible pane and has no role.
    const pane = detail.locator("[data-slot='scroll-area-viewport']");

    await expectInside(detail.getByText(IDA_METER_POINT, { exact: true }), pane);
    await expectInside(copy, pane);
    // A row wider than the pane scrolls it sideways and parks the button under its scrollbar.
    expect(await pane.evaluate((viewport) => viewport.scrollWidth - viewport.clientWidth)).toBe(0);
    expect(await auditTargets(copy.locator(".."))).toEqual({ targets: 1, misses: [] });
    await page.context().close();
  });

  it("raises the bulk toolbar once two rows are checked", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const toolbar = app.getByRole("toolbar", { name: "Bulk actions" });
    expect(await toolbar.count()).toBe(0);

    await app.getByRole("checkbox", { name: "Select Jonas Eide" }).click();
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).click();

    await toolbar.waitFor();
    expect(await toolbar.getByText("2 selected").isVisible()).toBe(true);
    expect(
      await toolbar
        .getByRole("button")
        .evaluateAll((buttons) => buttons.map((button) => button.textContent.trim()))
    ).toEqual(expect.arrayContaining(["Send SMS", "Send receipt", "Change seller"]));
    await page.context().close();
  });

  it("drops the checks the Closed tab hides, so Send SMS reaches only the visible order", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    const toolbar = app.getByRole("toolbar", { name: "Bulk actions" });

    // Jonas Eide awaits customer approval, so an SMS would reach him. Hanne Vik's order is done.
    await app.getByRole("checkbox", { name: "Select Jonas Eide" }).click();
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).click();
    await toolbar.waitFor();
    await app.getByRole("group", { name: "Orders to show" }).getByRole("button", { name: "Closed" }).click();
    await app.getByRole("checkbox", { name: "Select Hanne Vik" }).waitFor();
    await expect.poll(async () => toolbar.count()).toBe(0);

    await app.getByRole("checkbox", { name: "Select Hanne Vik" }).click();
    await toolbar.getByRole("button", { name: "Send SMS" }).click();
    await app
      .getByRole("region", { name: "Dashboard notifications" })
      .getByText("0 of 1 orders sent. 1 skipped: not awaiting customer approval.")
      .waitFor();
    await page.context().close();
  });

  it("collapses the sidebar with Control+B inside the window and never writes the host's sidebar cookie", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    // DOM audit: the rail's collapse state is the Sidebar's data-state; it has no role.
    const sidebar = app.locator("[data-slot='sidebar'][data-state]");
    expect(await sidebar.getAttribute("data-state")).toBe("expanded");

    await page.getByRole("heading", { level: 1 }).click();
    await page.keyboard.press("Control+b");
    expect(await sidebar.getAttribute("data-state")).toBe("expanded");

    await row(app, "Jonas Eide").focus();
    await page.keyboard.press("Control+b");
    await expect.poll(async () => sidebar.getAttribute("data-state")).toBe("collapsed");
    await app.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect.poll(async () => sidebar.getAttribute("data-state")).toBe("expanded");

    expect(await page.evaluate(() => document.cookie)).not.toContain("sidebar:state");
    await page.context().close();
  });

  it("counts open orders on the queues in the sidebar, as the Active tab lists them, and none on Order search", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    // DOM audit: Sidebar.MenuBadge is a sibling of the entry's button and has no role.
    const badge = (label: string) =>
      app
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: label, exact: true }) })
        .locator("[data-slot='sidebar-menu-badge']");

    for (const [label, count] of Object.entries(OPEN_COUNTS)) {
      expect(await badge(label).textContent()).toBe(count);
    }
    // Order search lists every status, so a count of open orders would not match its table.
    expect(await badge("Order search").count()).toBe(0);
    expect(await rowNames(app)).toHaveLength(Number(OPEN_COUNTS["My orders"]));
    await page.context().close();
  });

  it("shows the seller only in views shared between sellers", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    // DOM audit: the seller is an Avatar, which has no role.
    const avatar = (customer: string) => row(app, customer).locator("[data-slot='avatar']");

    expect(await avatar("Jonas Eide").count()).toBe(0);
    await openView(page, "Errors");
    expect(await avatar("Ingrid Haugland").textContent()).toBe("SG");
    expect(await avatar("Marius Kvam").textContent()).toBe("RF");
    await page.context().close();
  });

  it("fills the list pane with rows in every queue", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();

    const short: string[] = [];
    for (const label of QUEUES) {
      await openView(page, label);
      const list = app.getByRole("list", { name: "Orders" });
      // DOM audit: ScrollArea's viewport is the pane's visible box and has no role.
      // `has` resolves inside each candidate, so its locator starts from the page.
      const pane = await app
        .locator("[data-slot='scroll-area-viewport']", {
          has: page.getByRole("list", { name: "Orders" }),
        })
        .boundingBox();
      const last = await list
        .getByRole("button", { name: /^\p{Lu}/u })
        .last()
        .boundingBox();
      // The window fades from 78% of its height; rows must reach at least 70% of the pane.
      if (pane === null || last === null || last.y + last.height < pane.y + pane.height * 0.7) {
        short.push(label);
      }
    }
    expect(short).toEqual([]);
    await page.context().close();
  });

  it("opens every menu and popover in the window without a page error", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const errors = collectPageErrors(page);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    const detail = app.getByRole("complementary", { name: "Order details" });
    await row(app, "Jonas Eide").click();

    const menu = page.getByRole("menu");
    // A crashed menu never shows its items, so the poll settles on the first error instead.
    const openMenu = async (name: string, trigger: Locator) => {
      await trigger.click();
      await expect.poll(async () => errors.length > 0 || (await menu.count()) > 0).toBe(true);
      expect(errors, name).toEqual([]);
      await page.keyboard.press("Escape");
      await expect.poll(async () => menu.count()).toBe(0);
    };
    await openMenu("workspace switcher", app.getByRole("button", { name: /^Workspace:/u }));
    await openMenu("seller menu", app.getByRole("button", { name: /^Signed in as/u }));
    await openMenu("Display", app.getByRole("button", { name: "Display" }));
    await openMenu("status menu", detail.getByRole("button", { name: /^Status/u }));
    await openMenu("More actions", detail.getByRole("button", { name: "More actions" }));

    await app.getByRole("checkbox", { name: "Select Jonas Eide" }).click();
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).click();
    await app
      .getByRole("toolbar", { name: "Bulk actions" })
      .getByRole("button", { name: "Change seller" })
      .click();
    const changeSeller = page.getByRole("dialog", { name: "Change seller" });
    await changeSeller.getByRole("combobox", { name: "Seller" }).click();
    await page.getByRole("option").first().waitFor();
    expect(errors, "seller picker").toEqual([]);
    await page.context().close();
  });

  it("gives every control a target at least 24px in both directions, in the window and its open overlays", async () => {
    const page = await openLanding(WIDE_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    const detail = app.getByRole("complementary", { name: "Order details" });

    await expectTargets(app, "window");

    await app.getByRole("button", { name: /^Search/u }).click();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("option").first().waitFor();
    await expectTargets(palette, "command palette");
    await page.keyboard.press("Escape");
    await expect.poll(async () => palette.count()).toBe(0);

    await row(app, "Jonas Eide").click();
    await detail.getByRole("button", { name: /^Status/u }).click();
    const statusMenu = page.getByRole("menu");
    await statusMenu.getByRole("menuitemradio").first().waitFor();
    await expectTargets(statusMenu, "status menu");
    await page.keyboard.press("Escape");
    await expect.poll(async () => statusMenu.count()).toBe(0);

    await detail.getByRole("button", { name: "More actions" }).click();
    const moreMenu = page.getByRole("menu");
    await moreMenu.getByRole("menuitem").first().waitFor();
    await expectTargets(moreMenu, "More actions menu");
    await page.keyboard.press("Escape");
    await expect.poll(async () => moreMenu.count()).toBe(0);

    await app.getByRole("checkbox", { name: "Select Jonas Eide" }).click();
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).click();
    const toolbar = app.getByRole("toolbar", { name: "Bulk actions" });
    await toolbar.waitFor();
    await expectTargets(toolbar, "bulk toolbar");

    await toolbar.getByRole("button", { name: "Change seller" }).click();
    const changeSeller = page.getByRole("dialog", { name: "Change seller" });
    await changeSeller.waitFor();
    await expectTargets(changeSeller, "Change seller dialog");
    await page.keyboard.press("Escape");
    await expect.poll(async () => changeSeller.count()).toBe(0);
    await page.keyboard.press("Escape");

    await openOrderSearch(page);
    await expectTargets(app, "Order search");
    await app.getByRole("search", { name: "Order search" }).getByRole("button", { name: "Status" }).click();
    const facetMenu = page.getByRole("menu");
    await facetMenu.getByRole("menuitemcheckbox").first().waitFor();
    await expectTargets(facetMenu, "Status filter menu");
    await page.keyboard.press("Escape");
    await expect.poll(async () => facetMenu.count()).toBe(0);

    await app.getByRole("button", { name: /^New order/u }).click();
    const newOrder = page.getByRole("dialog", { name: "New order" });
    await newOrder.waitFor();
    await expectTargets(newOrder, "New order Sheet");
    await newOrder
      .getByRole("group", { name: "Start date" })
      .getByRole("button", { name: "Kalender" })
      .click();
    const calendar = page.getByRole("dialog").filter({ has: page.getByRole("grid") });
    await calendar.waitFor();
    await expectTargets(calendar, "Start date calendar");
    await page.context().close();
  });

  it("renders the Dashboard and its New order Sheet dense while the page outside the window stays comfortable", async () => {
    const page = await openLanding(WIDE_VIEWPORT);
    // DOM audit: the document's density is an attribute, with no role to query.
    expect(await page.evaluate(() => document.documentElement.dataset.density)).toBe("comfortable");
    const height = async (control: Locator) =>
      control.evaluate((element) => element.getBoundingClientRect().height);

    const browse = page.getByRole("button", { name: "Browse components ›" }).first();
    expect(await height(browse)).toBe(CONTROL_MD.comfortable);

    const app = await openOrderSearch(page);
    // DOM audit: the search field's md box is its input group, which has no role of its own.
    const searchGroup = app
      .getByRole("textbox", { name: "Search orders" })
      .locator("xpath=ancestor::*[@data-slot='input-group'][1]");
    expect(await height(searchGroup)).toBe(CONTROL_MD.dense);

    const sheet = await openNewOrder(app);
    expect(await height(sheet.getByRole("textbox", { name: "Name", exact: true }))).toBe(CONTROL_MD.dense);
    await page.context().close();
  });

  it("opens the sidebar and the detail as Sheets inside the window on a phone, without sideways scroll, and gives every control in its Sheets a target at least 24px in both directions", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();

    await app.getByRole("button", { name: "Toggle sidebar" }).click();
    const nav = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: /^My orders/u }) });
    await nav.waitFor();
    // Each Sheet's bounds first, before the audit scrolls its controls into view.
    await expectInside(nav, app);
    await expectTargets(nav, "sidebar Sheet");
    await page.keyboard.press("Escape");
    await expect.poll(async () => nav.count()).toBe(0);

    await row(app, "Ida Hagen").click();
    const detail = page.getByRole("dialog", { name: "Ida Hagen" });
    await detail.waitFor();
    await expectInside(detail, app);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBe(0);
    await expectTargets(detail, "detail Sheet");
    await page.keyboard.press("Escape");
    await expect.poll(async () => detail.count()).toBe(0);

    await app.getByRole("button", { name: "Toggle sidebar" }).click();
    await nav.getByRole("button", { name: /^New order/u }).click();
    const newOrder = page.getByRole("dialog", { name: "New order" });
    await newOrder.waitFor();
    await expectTargets(newOrder, "New order Sheet");
    // On a phone the Sheet fills the window's width. DOM audit: the window's theme scope, inside
    // its border, has no role.
    const scope = app.locator("[data-theme-variant]");
    const [sheetBox, scopeBox] = await Promise.all([newOrder.boundingBox(), scope.boundingBox()]);
    expect(sheetBox?.width).toBeCloseTo(scopeBox?.width ?? 0, 0);
    await page.context().close();
  });

  it("draws the list's scrollbar above a stuck group header", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    // DOM audit: ScrollArea's viewport and scrollbar have no role.
    const viewport = app.locator("[data-slot='scroll-area-viewport']", {
      has: page.getByRole("list", { name: "Orders" }),
    });
    const scrollbar = app.locator("[data-slot='scroll-area-scrollbar']").first();
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) {
      return;
    }
    // Hovering the pane shows the scrollbar; scrolling sticks a group header to the pane's top.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await viewport.evaluate((element) => {
      element.scrollTop = 300;
    });
    await expect.poll(async () => scrollbar.getAttribute("data-hovering")).toBe("");

    const bar = await scrollbar.boundingBox();
    expect(bar).not.toBeNull();
    if (bar === null) {
      return;
    }
    // A point in the scrollbar's lane at the stuck header's height lands on the scrollbar.
    const onBar = await scrollbar.evaluate(
      (element, point) => element.contains(document.elementFromPoint(point.x, point.y)),
      { x: bar.x + bar.width / 2, y: box.y + 18 }
    );
    expect(onBar).toBe(true);
    await page.context().close();
  });
});
