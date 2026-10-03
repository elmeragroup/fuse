import type { Locator, Page } from "playwright";
import { describe, expect, it } from "vitest";

import { DESKTOP_VIEWPORT, expectInside } from "./demo-page";
import {
  IDA_METER_POINT,
  PHONE_VIEWPORT,
  WIDE_VIEWPORT,
  dashboard,
  focusedCustomer,
  openOrderSearch,
  searchTable,
} from "./landing-dashboard";
import { launchLandingSuite } from "./landing-page";

const { openLanding } = launchLandingSuite();

/** The fixture's order count, which Order search lists with nothing narrowing it. */
const ALL_ORDERS = 51;

/** The customers on Order search's current page, in row order. */
async function tableCustomers(app: Locator): Promise<string[]> {
  // The body is the table's second row group. In each order's row, the only button opens it and
  // names its customer, as a queue row does; the empty state's row has no checkbox.
  return searchTable(app)
    .getByRole("rowgroup")
    .nth(1)
    .getByRole("row")
    .filter({ has: app.page().getByRole("checkbox") })
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-customer") ?? ""));
}

/** Order search's result count, as its toolbar states it. */
async function searchTotal(app: Locator): Promise<string | null> {
  return app.getByRole("search", { name: "Order search" }).getByRole("status").textContent();
}

/** Picks one option in a facet's menu and closes the menu. */
async function pickFacet(page: Page, app: Locator, facet: string, option: RegExp): Promise<void> {
  await app
    .getByRole("search", { name: "Order search" })
    .getByRole("button", { name: new RegExp(`^${facet}`, "u") })
    .click();
  await page.getByRole("menuitemcheckbox", { name: option }).click();
  await page.keyboard.press("Escape");
  await expect.poll(async () => page.getByRole("menu").count()).toBe(0);
}

describe("landing Dashboard Order search", () => {
  it("fits Order search on a phone without sideways page scroll", async () => {
    const page = await openLanding(PHONE_VIEWPORT);
    const app = dashboard(page);
    await app.scrollIntoViewIfNeeded();
    await app.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Order search", exact: true }).click();
    await searchTable(app).waitFor();
    const search = app.getByRole("search", { name: "Order search" });
    await expectInside(search, app);

    // With Reset showing, the field keeps a row of its own above Reset and the column menu.
    const field = search.getByRole("textbox", { name: "Search orders" });
    await field.fill("trondheim");
    const reset = search.getByRole("button", { name: "Reset" });
    await reset.waitFor();
    const [fieldBox, resetBox] = await Promise.all([field.boundingBox(), reset.boundingBox()]);
    expect(resetBox?.y ?? 0).toBeGreaterThanOrEqual((fieldBox?.y ?? 0) + (fieldBox?.height ?? 0));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBe(0);
    await page.context().close();
  });

  it("searches Order search by order number, customer, metering point and address", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const field = app.getByRole("textbox", { name: "Search orders" });
    expect(await searchTotal(app)).toBe(`${String(ALL_ORDERS)} orders`);

    await field.fill("284117");
    await expect.poll(async () => tableCustomers(app)).toEqual(["Ingrid Haugland"]);
    await field.fill("Ida Hagen");
    await expect.poll(async () => tableCustomers(app)).toEqual(["Ida Hagen"]);
    await field.fill(IDA_METER_POINT);
    await expect.poll(async () => tableCustomers(app)).toEqual(["Ida Hagen"]);
    // Eight facilities lie in Trondheim; no customer's name contains the word.
    await field.fill("trondheim");
    await expect
      .poll(async () => (await tableCustomers(app)).toSorted())
      .toEqual(
        [
          "Henrik Aasen",
          "Petter Halvorsen",
          "Tiril Aune",
          "Randi Steen",
          "Harald Bjerke",
          "Ragnhild Dale",
          "Marte Lunde",
          "Øystein Rønning",
        ].toSorted()
      );
    expect(await searchTotal(app)).toBe(`8 of ${String(ALL_ORDERS)} orders`);
    await page.context().close();
  });

  it("narrows Order search by each facet and restores every order on reset", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const customers = async () => (await tableCustomers(app)).toSorted();

    await pickFacet(page, app, "Status", /^Elhub failed/u);
    await expect
      .poll(customers)
      .toEqual(
        [
          "Ingrid Haugland",
          "Marius Kvam",
          "Camilla Røed",
          "Tor Inge Brekke",
          "Henrik Aasen",
          "Vilde Sæther",
        ].toSorted()
      );
    await app.getByRole("button", { name: "Reset" }).click();

    await pickFacet(page, app, "Sales channel", /^Winback/u);
    await expect.poll(async () => searchTotal(app)).toBe(`8 of ${String(ALL_ORDERS)} orders`);
    await app.getByRole("button", { name: "Reset" }).click();

    await pickFacet(page, app, "Price area", /^NO4/u);
    await expect
      .poll(customers)
      .toEqual(
        [
          "Ahmed Hassan",
          "Ingvild Sandvik",
          "Thea Moen",
          "Maja Johansen",
          "Sverre Nilsen",
          "Eirik Fjeld",
          "Hanne Vik",
        ].toSorted()
      );

    // Facets combine: StrømSmart+ in NO4 is one order.
    await pickFacet(page, app, "Product", /^StrømSmart\+/u);
    await expect.poll(customers).toEqual(["Hanne Vik"]);
    expect(await app.getByRole("button", { name: "Product, 1 selected" }).count()).toBe(1);

    await app.getByRole("button", { name: "Reset" }).click();
    await expect.poll(async () => searchTotal(app)).toBe(`${String(ALL_ORDERS)} orders`);
    expect(await app.getByRole("button", { name: "Reset" }).count()).toBe(0);
    await page.context().close();
  });

  it("sorts Order search by customer", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const header = searchTable(app).getByRole("columnheader", { name: "Customer" });

    await header.getByRole("button").click();
    await expect.poll(async () => header.getAttribute("aria-sort")).toBe("ascending");
    expect((await tableCustomers(app)).slice(0, 3)).toEqual([
      "Ahmed Hassan",
      "Amalie Berntsen",
      "Anders Lie",
    ]);

    await header.getByRole("button").click();
    await expect.poll(async () => header.getAttribute("aria-sort")).toBe("descending");
    expect((await tableCustomers(app))[0]).toBe("Øystein Rønning");
    await page.context().close();
  });

  it("raises the bulk toolbar from rows checked in Order search", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const toolbar = app.getByRole("toolbar", { name: "Bulk actions" });

    // Each search narrows the table to the row the test checks next.
    const field = app.getByRole("textbox", { name: "Search orders" });
    await field.fill("Haugland");
    await app.getByRole("checkbox", { name: "Select Ingrid Haugland" }).click();
    await field.fill("Ida Hagen");
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).click();
    await toolbar.getByText("1 selected").waitFor();
    // A check on a row the query hides drops with the row, so the toolbar counts what shows.
    await field.fill("");
    await expect.poll(async () => searchTotal(app)).toBe(`${String(ALL_ORDERS)} orders`);
    // Ida Hagen is not on the first page; her check stays beside the page's ten.
    await app.getByRole("checkbox", { name: /^Select all/u }).click();
    await toolbar.getByText("11 selected").waitFor();

    await toolbar.getByRole("button", { name: "Clear selection" }).click();
    await expect.poll(async () => toolbar.count()).toBe(0);
    expect(await app.getByRole("checkbox", { name: /^Select all/u }).getAttribute("aria-checked")).toBe(
      "false"
    );
    await page.context().close();
  });

  it("shows an empty state in Order search when nothing matches, and resets from it", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);

    await app.getByRole("textbox", { name: "Search orders" }).fill("Bergensbanen");
    await searchTable(app).getByText("No orders match").waitFor();
    expect(await tableCustomers(app)).toEqual([]);

    await searchTable(app).getByRole("button", { name: "Reset" }).click();
    await expect.poll(async () => searchTotal(app)).toBe(`${String(ALL_ORDERS)} orders`);
    expect(await app.getByRole("textbox", { name: "Search orders" }).inputValue()).toBe("");
    await page.context().close();
  });

  it("opens an order's detail in a Sheet from a press anywhere on its Order search row, leaving the table its width", async () => {
    const page = await openLanding(WIDE_VIEWPORT);
    const app = await openOrderSearch(page);
    // The table takes the pane's width; the queues' split detail pane stays out of it.
    expect(await app.getByRole("complementary", { name: "Order details" }).count()).toBe(0);
    await app.getByRole("textbox", { name: "Search orders" }).fill("Ida Hagen");
    await expect.poll(async () => tableCustomers(app)).toEqual(["Ida Hagen"]);

    await searchTable(app).getByRole("cell", { name: "Spotpris" }).click();
    const detail = page.getByRole("dialog", { name: "Ida Hagen" });
    await detail.waitFor();
    await expectInside(detail, app);
    await page.context().close();
  });

  it("opens an order's detail from the keyboard in Order search with the Customer column hidden", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    await app.getByRole("textbox", { name: "Search orders" }).fill("Ida Hagen");
    await expect.poll(async () => searchTotal(app)).toBe(`1 of ${String(ALL_ORDERS)} orders`);
    await app.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Customer" }).click();
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => searchTable(app).getByRole("columnheader", { name: "Customer" }).count())
      .toBe(0);

    // The row's next stop after its checkbox opens the order.
    await app.getByRole("checkbox", { name: "Select Ida Hagen" }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Ida Hagen" }).waitFor();
    await page.context().close();
  });

  it("moves through Order search's sorted rows with j and k, checks with x and opens with Enter", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const header = searchTable(app).getByRole("columnheader", { name: "Customer" });
    await header.getByRole("button").click();
    await expect.poll(async () => header.getAttribute("aria-sort")).toBe("ascending");

    // Focus sits on the sort button, inside the window and on no row: j starts at the first row.
    await page.keyboard.press("j");
    expect(await focusedCustomer(page)).toBe("Ahmed Hassan");
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    expect(await focusedCustomer(page)).toBe("Anders Lie");
    await page.keyboard.press("k");
    expect(await focusedCustomer(page)).toBe("Amalie Berntsen");

    await page.keyboard.press("x");
    await expect
      .poll(async () =>
        app.getByRole("checkbox", { name: "Select Amalie Berntsen" }).getAttribute("aria-checked")
      )
      .toBe("true");
    await app.getByRole("toolbar", { name: "Bulk actions" }).getByText("1 selected").waitFor();
    await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Amalie Berntsen" }).waitFor();
    await page.context().close();
  });

  it("keeps Order search's page while an order on it opens, changes status and closes", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const next = app.getByRole("button", { name: "Go to next page" });
    await next.click();
    await next.click();
    await app.getByText(`Page 3 of ${String(Math.ceil(ALL_ORDERS / 10))}`).waitFor();
    const onPage = await tableCustomers(app);
    const customer = onPage[0] ?? "";

    // A press on the row's product cell opens it, as anywhere on the row does.
    await searchTable(app)
      .getByRole("rowgroup")
      .nth(1)
      .getByRole("row")
      .first()
      .getByRole("cell")
      .nth(4)
      .click();
    const detail = page.getByRole("dialog", { name: customer });
    await detail.getByRole("button", { name: /^Status/u }).click();
    await page.getByRole("menuitemradio", { checked: false }).first().click();
    await app
      .getByRole("region", { name: "Dashboard notifications" })
      .getByText(/^Moved to/u)
      .waitFor();
    // The status menu stays open after a pick; the first Escape closes it, the second the Sheet.
    await page.keyboard.press("Escape");
    await expect.poll(async () => page.getByRole("menu").count()).toBe(0);
    await page.keyboard.press("Escape");
    await expect.poll(async () => detail.count()).toBe(0);

    await app.getByText(`Page 3 of ${String(Math.ceil(ALL_ORDERS / 10))}`).waitFor();
    expect(await tableCustomers(app)).toEqual(onPage);
    await page.context().close();
  });

  it("starts Order search on page one after a search from a later page is reset", async () => {
    const page = await openLanding(DESKTOP_VIEWPORT);
    const app = await openOrderSearch(page);
    const pages = Math.ceil(ALL_ORDERS / 10);
    const firstPage = await tableCustomers(app);
    const next = app.getByRole("button", { name: "Go to next page" });
    await next.click();
    await next.click();
    await app.getByText(`Page 3 of ${String(pages)}`).waitFor();

    await app.getByRole("textbox", { name: "Search orders" }).fill("Ida Hagen");
    await expect.poll(async () => tableCustomers(app)).toEqual(["Ida Hagen"]);
    await app.getByRole("button", { name: "Reset" }).click();

    await expect.poll(async () => searchTotal(app)).toBe(`${String(ALL_ORDERS)} orders`);
    await app.getByText(`Page 1 of ${String(pages)}`).waitFor();
    expect(await tableCustomers(app)).toEqual(firstPage);
    await page.context().close();
  });
});
