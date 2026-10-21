/**
 * Browser project. The add menu: field rows, value submenus, quick search, the cap and the
 * in-place drill, driven through a real TanStack v9 table. Expected rows, counts and orders are
 * written out by hand from the shared fixture's six rows, or computed from its fixture data.
 */
import { createRef, useLayoutEffect, useState } from "react";
import type { ComponentProps } from "react";

import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  active,
  CalendarStandIn,
  flipsIn,
  focusIs,
  menuOpen,
  Orders,
  ORDERS,
  PRODUCTS,
  FIELDS,
  columnFilters,
  CUSTOMER_NORD,
  STATUS_THREE,
  freezeToday,
  renderOrders,
  settled,
  visibleOrders,
  watchSides,
} from "../../../test/data-table-filter-fixture";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { glidePointerTo, turnWheel } from "../../../test/pointer-press";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { useDataTableFilter } from "./data-table-filter";
import type { FilterFieldMap } from "./filter-fields";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await emulateReducedMotion("no-preference");
  await page.viewport(414, 896);
});

/** The add menu's popup. */
function menu(): HTMLElement {
  return roleNamed("dialog", "Add filter");
}

/** The field rows' names, in order. */
function fieldRows(): string[] {
  return page
    .elementLocator(menu())
    .getByRole("menuitem")
    .elements()
    .map((row) => row.textContent);
}

/** Whether a row is lit by Base UI's virtual highlight. */
function lit(role: "menuitem" | "menuitemcheckbox", name: string): boolean {
  return roleNamed(role, name).hasAttribute("data-highlighted");
}

/** The menu's step, the field list or an editor. */
/** Whether a field's value submenu, a dialog named after the field, is in the page. */
function submenuOpen(field: string): boolean {
  return page.getByRole("dialog", { name: field }).query() !== null;
}

function step(): string | null {
  return menu().getAttribute("data-step");
}

async function openMenu(): Promise<void> {
  await userEvent.click(roleNamed("button", "Filter"));
  await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
}

describe("DataTableFilter add menu", () => {
  it("is a dialog named Add filter with a search and one menu row per field in config order", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    const trigger = roleNamed("button", "Filter");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(fieldRows()).toEqual(["Status", "Tags", "Customer", "Amount", "Created"]);
    expect(roleNamed("menuitem", "Status").getAttribute("aria-haspopup")).toBe("dialog");
    expect(roleNamed("menuitem", "Amount").hasAttribute("aria-haspopup")).toBe(false);
    expect(menu().offsetWidth).toBe(288);
  });

  it("ticks values live in a submenu, flips the operator at two values, and holds the Trigger still", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    const before = roleNamed("button", "Filter").getBoundingClientRect();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("menuitemcheckbox", { name: "Paid" }).query()).not.toBeNull();
    const rows = page.getByRole("menuitemcheckbox").elements();
    // Config order, each with its count over the six rows.
    expect(rows.map((row) => row.textContent)).toEqual([
      "Draft1",
      "Pending2",
      "Paid2",
      "Overdue1",
      "Cancelled0",
    ]);
    expect(roleNamed("menuitemcheckbox", "Paid").getAttribute("aria-checked")).toBe("false");

    await userEvent.click(roleNamed("menuitemcheckbox", "Paid"));
    await expect.poll(visibleOrders).toBe("1 3");
    expect(roleNamed("group", "Status filter")).toBeTruthy();
    expect(menuOpen()).toBe(true);
    await expect.poll(() => roleNamed("menuitemcheckbox", "Paid").getAttribute("aria-checked")).toBe("true");

    await userEvent.click(roleNamed("menuitemcheckbox", "Pending"));
    await expect.poll(visibleOrders).toBe("1 2 3 6");
    expect(roleNamed("combobox", "Status operator").textContent).toBe("is any of");
    expect(
      page
        .getByRole("menuitemcheckbox")
        .elements()
        .map((row) => row.textContent)
    ).toEqual(["Draft1", "Pending2", "Paid2", "Overdue1", "Cancelled0"]);
    const after = roleNamed("button", "Filter").getBoundingClientRect();
    expect([after.left, after.top]).toEqual([before.left, before.top]);

    await userEvent.click(roleNamed("menuitemcheckbox", "Paid"));
    await expect.poll(() => roleNamed("combobox", "Status operator").textContent).toBe("is");
    expect(visibleOrders()).toBe("2 6");
  });

  it("closes only the submenu on ArrowLeft and keeps the arrows, Home and End from the toolbar", async () => {
    renderOrders({ initial: [] });
    roleNamed("button", "Filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => lit("menuitem", "Status")).toBe(true);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => focusIs("searchbox", "Search Status")).toBe(true);
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => page.getByRole("searchbox", { name: "Search Status" }).query()).toBeNull();
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => lit("menuitem", "Status")).toBe(true);
    expect(menuOpen()).toBe(true);
  });

  it("keeps ArrowRight, Home and End in the search when a pointer open highlights nothing", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    for (const key of ["{ArrowRight}", "{Home}", "{End}"]) {
      await userEvent.keyboard(key);
      expect(active(), key).toBe(roleNamed("searchbox", "Search fields"));
      expect(menuOpen(), key).toBe(true);
    }
  });

  it("walks a submenu by keyboard: ticks with Enter, keeps the query, and goes back on a fresh Backspace", async () => {
    renderOrders({ initial: [] });
    roleNamed("button", "Filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => lit("menuitem", "Status")).toBe(true);
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => lit("menuitem", "Tags")).toBe(true);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => focusIs("searchbox", "Search Tags")).toBe(true);
    await userEvent.keyboard("pr");
    await expect.poll(() => page.getByRole("menuitemcheckbox").elements().length).toBe(1);
    await userEvent.keyboard("{Enter}");
    // Priority: orders 1, 3 and 6.
    await expect.poll(visibleOrders).toBe("1 3 6");
    expect(roleNamed("searchbox", "Search Tags")).toHaveProperty("value", "pr");
    await userEvent.keyboard("{Backspace}{Backspace}");
    expect(page.getByRole("searchbox", { name: "Search Tags" }).query()).not.toBeNull();
    await userEvent.keyboard("{Backspace}");
    await expect.poll(() => page.getByRole("searchbox", { name: "Search Tags" }).query()).toBeNull();
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => lit("menuitem", "Tags")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "Filter")).toBe(true);
  });

  it("closes on Tab past the bar and on Shift+Tab back to the Trigger", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.keyboard("{Tab}");
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "After the bar")).toBe(true);
    await openMenu();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "Filter")).toBe(true);
  });

  it("says a field has a filter and opens its submenu with the chip's values checked and pinned", async () => {
    renderOrders({
      initial: [{ id: "status", value: { kind: "option", operator: "is", values: ["paid"] } }],
    });
    await openMenu();
    expect(roleNamed("menuitem", "Status").getAttribute("aria-description")).toBe("Has a filter");
    expect(roleNamed("menuitem", "Tags").hasAttribute("aria-description")).toBe(false);
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("menuitemcheckbox").elements().length).toBe(5);
    const rows = page.getByRole("menuitemcheckbox").elements();
    expect(rows.map((row) => row.textContent)).toEqual([
      "Paid2",
      "Draft1",
      "Pending2",
      "Overdue1",
      "Cancelled0",
    ]);
    expect(roleNamed("menuitemcheckbox", "Paid").getAttribute("aria-checked")).toBe("true");
    expect(page.getByRole("separator").elements()).toHaveLength(1);
  });

  it("lists matching option values across fields from two characters on, and ticks them in place", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.keyboard("pe");
    const values = roleNamed("group", "Values");
    const quick = page.elementLocator(values).getByRole("menuitemcheckbox").elements();
    // "pe" matches Pending only: no field label and no tag contains it.
    expect(quick.map((row) => row.textContent)).toEqual(["Status › Pending2"]);
    await expect.poll(() => lit("menuitemcheckbox", "Status Pending")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(visibleOrders).toBe("2 6");
    expect(menuOpen()).toBe(true);
    expect(roleNamed("searchbox", "Search fields")).toHaveProperty("value", "pe");
    expect(roleNamed("menuitemcheckbox", "Status Pending").getAttribute("aria-checked")).toBe("true");
  });

  it("caps a 3,000-option field at 50 rows in count order with a status row, and narrows", async () => {
    renderOrders({ initial: [], products: true });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Product"));
    await expect.poll(() => page.getByRole("menuitemcheckbox").elements().length).toBe(50);
    // Oracle from the fixture: products by order count, highest first, then config order.
    const counts = new Map<string, number>();
    for (const order of ORDERS) {
      counts.set(order.product, (counts.get(order.product) ?? 0) + 1);
    }
    const expected = [...PRODUCTS]
      .map((product, index) => ({ product, index, count: counts.get(product.value) ?? 0 }))
      .sort((left, right) => right.count - left.count || left.index - right.index)
      .slice(0, 50)
      .map(({ product, count }) => `${product.label}${String(count)}`);
    expect(
      page
        .getByRole("menuitemcheckbox")
        .elements()
        .map((row) => row.textContent)
    ).toEqual(expected);
    const statuses = page
      .getByRole("status")
      .elements()
      .map((element) => element.textContent);
    expect(statuses).toContain("Type to narrow the list");
    const list =
      page.getByRole("menu", { name: "Product" }).query() ?? page.getByRole("menu").elements().at(-1);
    expect(list?.contains(page.getByText("Type to narrow the list").element())).toBe(false);

    await userEvent.keyboard("stone box 20");
    await expect.poll(() => page.getByRole("menuitemcheckbox").elements().length).toBe(2);
    expect(page.getByText("Type to narrow the list").query()).toBeNull();
  });

  it("starts each submenu's first row the same distance under its search", async () => {
    renderOrders({ initial: [], products: true });
    await openMenu();
    async function gapUnder(field: string): Promise<number> {
      await userEvent.fill(roleNamed("searchbox", "Search fields"), field);
      await expect.poll(() => lit("menuitem", field)).toBe(true);
      await userEvent.keyboard("{ArrowRight}");
      await expect.poll(() => focusIs("searchbox", `Search ${field}`)).toBe(true);
      await settled();
      const search = roleNamed("searchbox", `Search ${field}`);
      const [first] = page.getByRole("menuitemcheckbox").elements();
      if (first === undefined) {
        throw new Error(`expected ${field}'s rows`);
      }
      const gap = first.getBoundingClientRect().top - search.getBoundingClientRect().bottom;
      await userEvent.keyboard("{ArrowLeft}");
      await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
      return gap;
    }
    const status = await gapUnder("Status");
    const product = await gapUnder("Product");
    expect(product).toBeCloseTo(status, 0);
  });

  it("moves between the overlays with focus in the one that opened", async () => {
    renderOrders({
      initial: [{ id: "customer", value: { kind: "text", operator: "contains", values: ["nord"] } }],
    });
    await openMenu();
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await expect.poll(menuOpen).toBe(false);
    await userEvent.click(roleNamed("button", "Filter"));
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).toBeNull();
  });

  it("scrolls the page neither when a submenu opens nor on a drill", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingTop: "120vh", paddingBottom: "200vh" }}>
          <Orders initial={[]} />
        </div>
      )
    );
    roleNamed("button", "Filter").scrollIntoView({ block: "center" });
    const before = window.scrollY;
    await openMenu();
    // Playwright scrolls a row it presses while the menu still zooms in, so the press waits for
    // the open animation. Real input never scrolls the page.
    await settled();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("searchbox", { name: "Search Status" }).query()).not.toBeNull();
    await settled();
    expect(window.scrollY).toBe(before);
    await userEvent.fill(roleNamed("searchbox", "Search fields"), "cus");
    await expect.poll(() => lit("menuitem", "Customer")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    expect(window.scrollY).toBe(before);
  });

  it("opens above the bar by the bottom edge and holds its side through typing and a drill", async () => {
    // The bar's top 6rem above the viewport's bottom edge, too little room for the menu below.
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingTop: "calc(100vh - 6rem)" }}>
          <Orders initial={[]} />
        </div>
      )
    );
    const stop = watchSides();
    await openMenu();
    await settled();
    await userEvent.keyboard("am");
    await expect.poll(() => lit("menuitem", "Amount")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(step).toBe("editor");
    await settled();
    const frames = stop();
    expect(window.scrollY).toBe(0);
    expect(frames.length).toBeGreaterThan(10);
    expect(flipsIn(frames)).toBe(0);
    expect(frames.at(-1)?.[0]).toBe("top");
  });

  it("reports the field a submenu or a drill opens, and null once the menu closes", async () => {
    const seen: (string | null)[] = [];
    renderOrders({ initial: [], onActiveFieldChange: (fieldId) => seen.push(fieldId) });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => seen.at(-1)).toBe("status");
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("cus{Enter}");
    await expect.poll(() => seen.at(-1)).toBe("customer");
    await userEvent.keyboard("{Escape}{Escape}");
    await expect.poll(() => seen.at(-1)).toBe(null);
  });

  it("reports a sibling submenu's field once, without null, when it replaces an open one", async () => {
    const seen: (string | null)[] = [];
    renderOrders({ initial: [], onActiveFieldChange: (fieldId) => seen.push(fieldId) });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => submenuOpen("Status")).toBe(true);
    // A click with no pointer move, so Tags opens first and Base UI then closes Status.
    roleNamed("menuitem", "Tags").click();
    await expect.poll(() => submenuOpen("Tags")).toBe(true);
    await expect.poll(() => submenuOpen("Status")).toBe(false);
    await settled();
    expect(seen).toEqual(["status", "tags"]);
  });
});

describe("DataTableFilter in-place editor", () => {
  it("drills a text field in place, applies live, keeps its keys, and goes back with the row lit", async () => {
    renderOrders({ initial: [] });
    roleNamed("button", "Filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    const width = menu().offsetWidth;
    await userEvent.keyboard("cus");
    await expect.poll(() => lit("menuitem", "Customer")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    expect(step()).toBe("editor");
    expect(page.getByRole("searchbox", { name: "Search fields" }).query()).toBeNull();
    expect(roleNamed("group", "Customer")).toBeTruthy();
    expect(roleNamed("button", "Back to fields")).toBeTruthy();
    expect(roleNamed("combobox", "Customer operator")).toBeTruthy();
    expect(menu().offsetWidth).toBe(width);
    expect(page.getByRole("group", { name: "Customer filter" }).query()).toBeNull();

    await userEvent.keyboard("kafe");
    // Accents ignored: "kafe" matches Nordlys Kafé only.
    await expect.poll(visibleOrders).toBe("4");
    expect(menuOpen()).toBe(true);
    expect(roleNamed("group", "Customer filter").hasAttribute("data-ghost")).toBe(false);

    // Recorded in the capture phase and read once dispatch is over, so a handler anywhere on the
    // path that prevents a key counts.
    const events: KeyboardEvent[] = [];
    const record = (event: KeyboardEvent) => {
      events.push(event);
    };
    window.addEventListener("keydown", record, true);
    await userEvent.keyboard("{Home}{End}{ArrowLeft}{ArrowRight}");
    window.removeEventListener("keydown", record, true);
    expect(events.map((event) => [event.key, event.defaultPrevented])).toEqual([
      ["Home", false],
      ["End", false],
      ["ArrowLeft", false],
      ["ArrowRight", false],
    ]);
    expect(active()).toBe(roleNamed("textbox", "Customer"));

    await userEvent.keyboard("{Escape}");
    await expect.poll(step).toBe("fields");
    expect(menuOpen()).toBe(true);
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => lit("menuitem", "Customer")).toBe(true);
    expect(roleNamed("searchbox", "Search fields")).toHaveProperty("value", "cus");
    expect(visibleOrders()).toBe("4");
    await userEvent.keyboard("{Escape}");
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "Filter")).toBe(true);
    expect(roleNamed("button", "“kafe”")).toBeTruthy();
  });

  it("goes back on a fresh Backspace in an empty text input and on the Back button, applying nothing", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("{Backspace}");
    await expect.poll(step).toBe("fields");
    await expect.poll(() => lit("menuitem", "Customer")).toBe(true);

    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(step).toBe("editor");
    await userEvent.click(roleNamed("button", "Back to fields"));
    await expect.poll(step).toBe("fields");
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => lit("menuitem", "Amount")).toBe(true);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
    expect(page.getByRole("group", { name: "Amount filter" }).query()).toBeNull();
  });

  it("leaves the editor on Tab past its last control and on Shift+Tab from Back", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("{Tab}");
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "After the bar")).toBe(true);

    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(() => focusIs("combobox", "Customer operator")).toBe(true);
    expect(menuOpen()).toBe(true);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(() => focusIs("button", "Back to fields")).toBe(true);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "Filter")).toBe(true);
  });

  it("edits a number in place: the facet range as its draft, blur commits, the keys stay, an operator converts", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    const minimum = roleNamed("textbox", "Minimum");
    expect(minimum).toHaveProperty("value", "60");
    expect(roleNamed("textbox", "Maximum")).toHaveProperty("value", "950");
    expect(page.getByRole("slider").elements()).toHaveLength(2);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");

    await userEvent.fill(minimum, "300");
    await userEvent.keyboard("{Tab}");
    // 300 to 950: Fjellstue at 480, Havbris at 950, Café Nord at 300, Bryggen at 780.
    await expect.poll(visibleOrders).toBe("2 3 5 6");
    expect(menuOpen()).toBe(true);

    minimum.focus();
    await userEvent.keyboard("{ArrowUp}");
    await expect.poll(() => minimum).toHaveProperty("value", "310");
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => minimum).toHaveProperty("value", "300");
    expect(active()).toBe(minimum);

    const maxThumb = roleNamed("slider", "Maximum");
    maxThumb.focus();
    await userEvent.keyboard("{PageDown}");
    // The large step is 100, so the maximum falls to 850 and Havbris at 950 leaves.
    await expect.poll(visibleOrders).toBe("2 5 6");
    expect(active()).toBe(maxThumb);
    expect(menuOpen()).toBe(true);

    const operator = page.elementLocator(menu()).getByRole("combobox", { name: "Amount operator" }).element();
    if (!(operator instanceof HTMLElement)) {
      throw new Error("expected the header operator");
    }
    operator.focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("listbox").query()).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("listbox").query()).toBeNull();
    expect(step()).toBe("editor");
    expect(menuOpen()).toBe(true);

    await userEvent.click(operator);
    await userEvent.click(roleNamed("option", "is at least"));
    // At least 300: Fjellstue, Havbris, Café Nord and Bryggen.
    await expect.poll(visibleOrders).toBe("2 3 5 6");
    expect(menuOpen()).toBe(true);
  });

  it("drills another field once the pointer glides off an open submenu, which closes", async () => {
    // Wide enough for the submenu to sit beside its row, so the next row stays in reach.
    await page.viewport(1280, 800);
    renderOrders({ initial: [] });
    await openMenu();
    await settled();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("searchbox", { name: "Search Status" }).query()).not.toBeNull();
    // A hand travels to the next row. Base UI holds the menu's rows still while the pointer may
    // still be heading into the submenu, so a jump straight to the row is not what a person does.
    await glidePointerTo(roleNamed("menuitem", "Amount"));
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(step).toBe("editor");
    await expect.poll(() => page.getByRole("searchbox", { name: "Search Status" }).query()).toBeNull();
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
  });

  it("drills a field that has a chip with the chip's operator and value, and keeps one chip", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isGreaterThanOrEqual", values: [300] } }],
    });
    await openMenu();
    expect(roleNamed("menuitem", "Amount").getAttribute("aria-description")).toBe("Has a filter");
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(step).toBe("editor");
    expect(
      page.elementLocator(menu()).getByRole("combobox", { name: "Amount operator" }).element().textContent
    ).toBe("is at least");
    expect(page.elementLocator(menu()).getByRole("textbox", { name: "Amount" }).element()).toHaveProperty(
      "value",
      "300"
    );
    expect(page.getByRole("group", { name: "Amount filter" }).elements()).toHaveLength(1);
  });

  it("reports a drilled field at once while the value popover it replaced still closes", async () => {
    const seen: (string | null)[] = [];
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={CUSTOMER_NORD} onActiveFieldChange={(fieldId) => seen.push(fieldId)}>
          <DataTableFilter.Bar />
          <DataTableFilter.Content />
          {/* A long exit, so the drill happens while Customer's editor is still mounted. */}
          <DataTableFilter.ValueContent style={{ transitionDuration: "6s", animationDuration: "6s" }} />
        </Orders>
      )
    );
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(step).toBe("editor");
    await expect.poll(() => seen.at(-1)).toBe("amount");
    expect(page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
    await expect
      .poll(() => page.getByRole("dialog", { name: "Customer" }).query(), { timeout: 12000 })
      .toBeNull();
    await settled();
    // The menu opens on its field list, so Customer gives way to no field, then to the drill.
    expect(seen).toEqual(["customer", null, "amount"]);
  });

  describe("edit() while the menu closes", () => {
    const captured = createRef<ReturnType<typeof useDataTableFilter>["actions"]>();
    function Capture(): null {
      const { actions } = useDataTableFilter();
      useLayoutEffect(() => {
        captured.current = actions;
      });
      return null;
    }
    function act(): ReturnType<typeof useDataTableFilter>["actions"] {
      if (captured.current === null) {
        throw new Error("expected the filter's actions");
      }
      return captured.current;
    }

    /** Both chips, the menu open, and every active field the Root reports. */
    async function openWithChips(
      content: ComponentProps<typeof DataTableFilter.Content> = {}
    ): Promise<(string | null)[]> {
      const seen: (string | null)[] = [];
      renderOrders({
        initial: [...STATUS_THREE, ...CUSTOMER_NORD],
        onActiveFieldChange: (fieldId) => seen.push(fieldId),
        children: (
          <>
            <DataTableFilter.Bar />
            <DataTableFilter.Content {...content} />
            <DataTableFilter.ValueContent />
            <Capture />
          </>
        ),
      });
      await openMenu();
      return seen;
    }

    it("opens no editor when close() follows a queued edit()", async () => {
      const seen = await openWithChips();
      act().edit("status");
      act().close();
      await expect.poll(menuOpen).toBe(false);
      await settled();
      await settled();
      expect(page.getByRole("dialog", { name: "Status" }).query()).toBeNull();
      expect(seen.at(-1) ?? null).toBeNull();
    });

    it("opens only the newer of two queued edits", async () => {
      const seen = await openWithChips();
      act().edit("status");
      act().edit("customer");
      await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
      await settled();
      await settled();
      expect(page.getByRole("dialog", { name: "Status" }).query()).toBeNull();
      expect(seen.at(-1)).toBe("customer");
      expect(seen).not.toContain("status");
    });

    it("reports a drill again when the menu reopens onto it during the exit close() began", async () => {
      // A long exit, so the Trigger reopens the menu before its close completes.
      const seen = await openWithChips({ style: { transitionDuration: "6s", animationDuration: "6s" } });
      await userEvent.click(roleNamed("menuitem", "Amount"));
      await expect.poll(step).toBe("editor");
      act().close();
      await expect.poll(() => seen.at(-1)).toBeNull();
      await userEvent.click(roleNamed("button", "Filter"), { force: true });
      await expect.poll(() => seen).toEqual(["amount", null, "amount"]);
      expect(step()).toBe("editor");
      expect(
        page.elementLocator(menu()).getByRole("combobox", { name: "Amount operator" }).query()
      ).not.toBeNull();
      await settled();
      expect(seen).toEqual(["amount", null, "amount"]);
    });

    /** A long menu exit, so a press on Filter reopens the menu before its close completes. */
    const LONG_EXIT = { style: { transitionDuration: "6s", animationDuration: "6s" } };

    /** A setup that leaves the Root as it rendered. */
    async function nothing(): Promise<void> {
      await settled();
    }

    async function pressFilter(): Promise<void> {
      await userEvent.click(roleNamed("button", "Filter"), { force: true });
    }

    async function drillAmount(): Promise<void> {
      await openMenu();
      await userEvent.click(roleNamed("menuitem", "Amount"));
      await expect.poll(step).toBe("editor");
    }

    async function openCustomer(): Promise<void> {
      await userEvent.click(roleNamed("button", "“nord”"));
      await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
    }

    /** The field list's search, which takes focus when the menu opens on the list. */
    const SEARCH = ["searchbox", "Search fields"] as const;
    /** Amount's in-place editor's first control, which takes focus when the menu shows the drill. */
    const MINIMUM = ["textbox", "Minimum"] as const;

    type MenuOpenRow = readonly [
      state: string,
      setup: () => Promise<void>,
      open: () => Promise<void>,
      expected: readonly (string | null)[],
      focused: typeof SEARCH | typeof MINIMUM,
    ];
    const MENU_OPEN_ROWS: readonly MenuOpenRow[] = [
      ["nothing active", nothing, pressFilter, [], SEARCH],
      [
        "a queued value intent",
        async () => {
          await openMenu();
          act().edit("status");
        },
        pressFilter,
        ["status", null],
        SEARCH,
      ],
      ["a live value intent", openCustomer, pressFilter, ["customer", null], SEARCH],
      [
        "a newer drill",
        nothing,
        async () => {
          act().edit("amount");
          await expect.poll(menuOpen).toBe(true);
        },
        ["amount"],
        MINIMUM,
      ],
      [
        "a drill close() cleared",
        async () => {
          await drillAmount();
          act().close();
        },
        pressFilter,
        ["amount", null, "amount"],
        MINIMUM,
      ],
      [
        "another chip's editor during a drill's exit",
        async () => {
          await drillAmount();
          await openCustomer();
        },
        pressFilter,
        ["amount", "customer", "amount"],
        MINIMUM,
      ],
    ];

    it.each(MENU_OPEN_ROWS)(
      "reports and focuses the field the menu shows when it opens from %s",
      async (_state, setup, open, expected, [role, name]) => {
        const seen: (string | null)[] = [];
        renderOrders({
          initial: [...STATUS_THREE, ...CUSTOMER_NORD],
          onActiveFieldChange: (fieldId) => seen.push(fieldId),
          children: (
            <>
              <DataTableFilter.Bar />
              <DataTableFilter.Content {...LONG_EXIT} />
              <DataTableFilter.ValueContent />
              <Capture />
            </>
          ),
        });
        await setup();
        await open();
        await expect.poll(menuOpen).toBe(true);
        await expect.poll(() => seen).toEqual(expected);
        await expect.poll(() => focusIs(role, name)).toBe(true);
        // The other overlay's exit ends, and the record and the focus hold.
        await settled();
        await settled();
        expect(menuOpen()).toBe(true);
        expect(focusIs(role, name)).toBe(true);
        expect(seen).toEqual(expected);
      }
    );

    it("drops a queued edit when the menu reopens during its exit, and opens nothing on the next close", async () => {
      // A long exit, so the Trigger reopens the menu before its close completes.
      const seen = await openWithChips({ style: { transitionDuration: "6s", animationDuration: "6s" } });
      act().edit("status");
      await userEvent.click(roleNamed("button", "Filter"), { force: true });
      await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
      await settled();
      // The field list is open, so no field is active.
      expect(seen.at(-1) ?? null).toBeNull();
      await userEvent.keyboard("{Escape}");
      await expect.poll(menuOpen, { timeout: 12000 }).toBe(false);
      await settled();
      await settled();
      expect(page.getByRole("dialog", { name: "Status" }).query()).toBeNull();
      expect(seen.at(-1) ?? null).toBeNull();
    });
  });

  it("keeps focus in the in-place editor's operator popup while the value popover it replaced closes", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders
          initial={[
            { id: "amount", value: { kind: "number", operator: "isGreaterThanOrEqual", values: [300] } },
          ]}>
          <DataTableFilter.Bar />
          <DataTableFilter.Content />
          {/* A long exit, so the menu's operator popup opens while the popover is still closing. */}
          <DataTableFilter.ValueContent style={{ transitionDuration: "6s", animationDuration: "6s" }} />
        </Orders>
      )
    );
    const chip = page.getByRole("group", { name: "Amount filter" });
    // The chip's buttons are its Value, then its Remove.
    await userEvent.click(chip.getByRole("button").first());
    await expect.poll(() => focusIs("textbox", "Amount")).toBe(true);
    // Escape starts the popover's exit, which returns focus once it ends, unless focus moved on.
    await userEvent.keyboard("{Escape}");
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(step).toBe("editor");
    await userEvent.click(page.elementLocator(menu()).getByRole("combobox", { name: "Amount operator" }));
    const listbox = page.getByRole("listbox");
    await expect.poll(() => listbox.element().contains(active())).toBe(true);
    // The popover is still closing, then unmounts, and focus stays in the operator's popup.
    expect(page.getByRole("dialog", { name: "Amount" }).query()).not.toBeNull();
    await expect
      .poll(() => page.getByRole("dialog", { name: "Amount" }).query(), { timeout: 12000 })
      .toBeNull();
    await settled();
    expect(listbox.element().contains(active())).toBe(true);
  });

  it("applies a date preset and closes the menu with focus on the Trigger", async () => {
    freezeToday();
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(() => focusIs("button", "Today")).toBe(true);
    await userEvent.click(roleNamed("button", "Last 30 days"));
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "Filter")).toBe(true);
    // The 30 days through 2026-10-12, written out: orders 1 to 4 fall inside, 5 and 6 after.
    expect(columnFilters()).toEqual([
      { id: "created", value: { kind: "date", operator: "isBetween", values: ["2026-09-13", "2026-10-12"] } },
    ]);
    expect(visibleOrders()).toBe("1 2 3 4");
  });

  it("opens the menu onto a drill from edit(), and Back lights the field's row", async () => {
    function EditAmount() {
      const { actions } = useDataTableFilter();
      return (
        <button
          type="button"
          onClick={() => {
            actions.edit("amount");
          }}>
          Edit amount
        </button>
      );
    }
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[]}>
          <DataTableFilter.Bar />
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
          <EditAmount />
        </Orders>
      )
    );
    await userEvent.click(roleNamed("button", "Edit amount"));
    await expect.poll(() => focusIs("textbox", "Minimum")).toBe(true);
    expect(step()).toBe("editor");
    await userEvent.click(roleNamed("button", "Back to fields"));
    await expect.poll(step).toBe("fields");
    await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
    await expect.poll(() => lit("menuitem", "Amount")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(step).toBe("editor");
  });
});

describe("DataTableFilter add menu motion and placement", () => {
  it("morphs the menu's height on a drill with motion on, and swaps at once under reduced motion", async () => {
    renderOrders({
      initial: [],
      // The morph stretched from 100 ms to a second, so a slow runner still sees it pinned.
      children: (
        <>
          <DataTableFilter.Bar />
          <DataTableFilter.Content style={{ transitionDuration: "1s" }} />
          <DataTableFilter.ValueContent />
        </>
      ),
    });
    await openMenu();
    const popup = menu();
    const fieldsHeight = popup.offsetHeight;
    await userEvent.click(roleNamed("menuitem", "Customer"));
    // The step change pins the height and lets the transition run to the editor's height.
    expect(getComputedStyle(popup).transitionProperty).toContain("height");
    expect(popup.style.height).not.toBe("");
    await expect.poll(() => popup.style.height, { timeout: 5000 }).toBe("");
    expect(popup.offsetHeight).not.toBe(fieldsHeight);

    await userEvent.click(roleNamed("button", "Back to fields"));
    await expect.poll(step).toBe("fields");
    await emulateReducedMotion("reduce");
    await userEvent.click(roleNamed("menuitem", "Customer"));
    await expect.poll(step).toBe("editor");
    expect(getComputedStyle(popup).transitionProperty).not.toContain("height");
    expect(popup.style.height).toBe("");
  });

  it("moves between the date presets with the arrow keys as soon as a drill opens them", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(() => focusIs("button", "Today")).toBe(true);
    // The focused preset holds the group's one tab stop.
    expect(roleNamed("button", "Today").tabIndex).toBe(0);
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => focusIs("button", "Last 7 days")).toBe(true);
  });

  /** The add menu with a calendar in the date editor's slot. */
  function renderWithCalendar(): void {
    renderOrders({
      initial: [],
      children: (
        <>
          <DataTableFilter.Bar />
          <DataTableFilter.Content>
            <DataTableFilter.FieldList />
            <DataTableFilter.Editor>
              <DataTableFilter.DateEditor>{() => <CalendarStandIn />}</DataTableFilter.DateEditor>
            </DataTableFilter.Editor>
          </DataTableFilter.Content>
          <DataTableFilter.ValueContent />
        </>
      ),
    });
  }

  it("widens the menu to a calendar beside its presets on a drill, and narrows it on Back", async () => {
    // DOM audit: the morph runs on the popup's own 100 ms transition, stretched to a second. Base
    // UI's mount-time `transition: none` would wipe an inline duration, so a rule holds it.
    const slow = document.createElement("style");
    slow.textContent = "[data-slot=data-table-filter-content] { transition-duration: 1s !important; }";
    document.head.append(slow);
    onTestFinished(() => {
      slow.remove();
    });
    await page.viewport(1280, 800);
    renderWithCalendar();
    await openMenu();
    const popup = menu();
    expect(popup.offsetWidth).toBe(288);
    await userEvent.click(roleNamed("menuitem", "Created"));
    // The step change pins the width and lets the transition run to the editor's width.
    expect(getComputedStyle(popup).transitionProperty).toContain("width");
    expect(popup.style.width).not.toBe("");
    await expect.poll(() => popup.style.width, { timeout: 5000 }).toBe("");
    const today = roleNamed("button", "Today").getBoundingClientRect();
    const week = roleNamed("button", "Last 7 days").getBoundingClientRect();
    const calendar = roleNamed("button", "Calendar").getBoundingClientRect();
    const frame = popup.getBoundingClientRect();
    // The presets stand in a column, and the calendar beside it fits inside the wider popup.
    expect(week.left).toBe(today.left);
    expect(week.top).toBeGreaterThanOrEqual(today.bottom);
    expect(calendar.left).toBeGreaterThan(today.right);
    expect(calendar.right).toBeLessThanOrEqual(frame.right);
    expect(frame.width).toBeGreaterThan(288);
    // The column's arrow keys run down it.
    await expect.poll(() => focusIs("button", "Today")).toBe(true);
    await userEvent.keyboard("{ArrowDown}");
    await expect.poll(() => focusIs("button", "Last 7 days")).toBe(true);

    await userEvent.click(roleNamed("button", "Back to fields"));
    await expect.poll(step).toBe("fields");
    expect(popup.style.width).not.toBe("");
    await expect.poll(() => popup.style.width, { timeout: 5000 }).toBe("");
    expect(popup.offsetWidth).toBe(288);
  });

  it("keeps the presets above the calendar on a narrow viewport, at the menu's own width", async () => {
    await page.viewport(414, 896);
    renderWithCalendar();
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(step).toBe("editor");
    await expect.poll(() => menu().style.width, { timeout: 5000 }).toBe("");
    const today = roleNamed("button", "Today").getBoundingClientRect();
    const week = roleNamed("button", "Last 7 days").getBoundingClientRect();
    expect(week.top).toBe(today.top);
    expect(roleNamed("button", "Calendar").getBoundingClientRect().top).toBeGreaterThanOrEqual(today.bottom);
    expect(menu().offsetWidth).toBe(288);
  });

  it("keeps the presets above the date inputs on a wide viewport, at the menu's own width", async () => {
    await page.viewport(1280, 800);
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(step).toBe("editor");
    await settled();
    const today = roleNamed("button", "Today").getBoundingClientRect();
    expect(roleNamed("button", "Last 7 days").getBoundingClientRect().top).toBe(today.top);
    expect(menu().offsetWidth).toBe(288);
  });
});

describe("DataTableFilter in-place editor overflow", () => {
  it("scrolls a tall editor inside the menu under a still header, and never the page", async () => {
    await page.viewport(1280, 720);
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingBottom: "200vh" }}>
          <Orders initial={[]}>
            <DataTableFilter.Bar />
            <DataTableFilter.Content>
              <DataTableFilter.FieldList />
              <DataTableFilter.Editor>
                <DataTableFilter.DateEditor>
                  {(editor) => (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ height: 600 }}>A tall calendar</div>
                      <button
                        type="button"
                        onClick={() => {
                          editor.onValueChange(["2026-10-01", "2026-10-31"]);
                        }}>
                        October
                      </button>
                    </div>
                  )}
                </DataTableFilter.DateEditor>
              </DataTableFilter.Editor>
            </DataTableFilter.Content>
            <DataTableFilter.ValueContent />
          </Orders>
        </div>
      )
    );
    await openMenu();
    await settled();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(step).toBe("editor");
    await settled();
    const before = window.scrollY;
    const popup = menu();
    const back = roleNamed("button", "Back to fields");
    const backTop = back.getBoundingClientRect().top;
    // The wheel turns over the editor's first preset, which sits in view at the top of its body.
    await glidePointerTo(roleNamed("button", "Today"));
    await turnWheel(2000);
    await settled();
    const october = roleNamed("button", "October");
    const box = october.getBoundingClientRect();
    const frame = popup.getBoundingClientRect();
    // The last control scrolled into the popup's box, and a press there reaches it.
    expect(box.bottom).toBeLessThanOrEqual(frame.bottom);
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).toBe(october);
    expect(back.getBoundingClientRect().top).toBe(backTop);
    expect(window.scrollY).toBe(before);
    await userEvent.click(october);
    // Every order but Nordlys Kafé's, from September 28, falls in October.
    await expect.poll(visibleOrders).toBe("1 2 3 5 6");
    expect(window.scrollY).toBe(before);
  });
});

describe("DataTableFilter host wiring", () => {
  it("reports each change of the active field once to an inline callback that sets host state", async () => {
    const calls: (string | null)[] = [];
    function Host() {
      const [, setFetches] = useState(0);
      return (
        <Orders
          initial={[]}
          onActiveFieldChange={(fieldId) => {
            calls.push(fieldId);
            setFetches((count) => count + 1);
          }}
        />
      );
    }
    renderThemed(withLocale("en-US", <Host />));
    await settled();
    expect(calls).toEqual([]);
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => calls).toEqual(["status"]);
    await userEvent.keyboard("{ArrowLeft}{Escape}");
    await expect.poll(menuOpen).toBe(false);
    await settled();
    expect(calls).toEqual(["status", null]);
  });

  it("names the add menu and each value submenu as dialogs, as they open and once their lists mount", async () => {
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    await expect.poll(() => page.getByRole("dialog", { name: "Add filter" }).query()).not.toBeNull();
    await settled();
    expect(roleNamed("dialog", "Add filter")).toBe(menu());
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("dialog", { name: "Status" }).query()).not.toBeNull();
    await settled();
    const submenu = roleNamed("dialog", "Status");
    expect(page.elementLocator(submenu).getByRole("menuitemcheckbox").elements()).toHaveLength(5);
  });

  it("writes nothing for a value whose option was removed while its submenu was open", async () => {
    const view = renderThemed(withLocale("en-US", <Orders initial={[]} fields={FIELDS} />));
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("menuitemcheckbox", { name: "Cancelled" }).query()).not.toBeNull();
    const fewer: FilterFieldMap = {
      ...FIELDS,
      status: {
        ...FIELDS.status,
        options: FIELDS.status.options.filter((option) => option.value !== "cancelled"),
      },
    };
    view.rerender(withLocale("en-US", <Orders initial={[]} fields={fewer} />));
    await userEvent.click(roleNamed("menuitemcheckbox", "Cancelled"));
    await settled();
    expect(columnFilters()).toEqual([]);
  });

  it("hands each overlay's popup to a consumer ref and keeps its own focus and morph wiring", async () => {
    const menuRef = createRef<HTMLDivElement>();
    const valueRef = createRef<HTMLDivElement>();
    renderThemed(
      withLocale(
        "en-US",
        <Orders
          initial={[{ id: "customer", value: { kind: "text", operator: "contains", values: ["nord"] } }]}>
          <DataTableFilter.Bar />
          <DataTableFilter.Content ref={menuRef} />
          <DataTableFilter.ValueContent ref={valueRef} />
        </Orders>
      )
    );
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => focusIs("textbox", "Customer")).toBe(true);
    expect(valueRef.current).toBe(roleNamed("dialog", "Customer"));
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).toBeNull();
    await settled();

    await openMenu();
    await settled();
    expect(menuRef.current).toBe(menu());
    await userEvent.click(roleNamed("menuitem", "Amount"));
    // The step change pins the height for the morph, which the internal popup ref drives.
    expect(menu().style.height).not.toBe("");
    await expect.poll(() => menu().style.height).toBe("");
  });
});

describe("DataTableFilter add menu locales", () => {
  it.each(SUPPORTED_LOCALES)("names the menu, its searches and Back in %s", async (locale) => {
    const names = {
      "en-US": ["Filter", "Add filter", "Search fields", "Search Status", "Back to fields"],
      "nb-NO": ["Filter", "Legg til filter", "Søk i felt", "Søk i Status", "Tilbake til felt"],
      "sv-SE": ["Filter", "Lägg till filter", "Sök fält", "Sök Status", "Tillbaka till fält"],
      "fi-FI": ["Suodata", "Lisää suodatin", "Hae kenttiä", "Hae: Status", "Takaisin kenttiin"],
    } as const satisfies Record<SupportedLocale, readonly [string, string, string, string, string]>;
    const [trigger, dialog, fields, values, back] = names[locale];
    renderOrders({ initial: [] }, locale);
    roleNamed("button", trigger).focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => focusIs("searchbox", fields)).toBe(true);
    expect(roleNamed("dialog", dialog)).toBeTruthy();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(() => focusIs("searchbox", values)).toBe(true);
    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(() => focusIs("searchbox", fields)).toBe(true);
    await userEvent.fill(roleNamed("searchbox", fields), "Customer");
    await expect.poll(() => lit("menuitem", "Customer")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("button", { name: back, exact: true }).query()).not.toBeNull();
  });
});
