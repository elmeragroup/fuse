/**
 * Browser project. The add menu: field rows, value submenus, quick search, the cap and the
 * in-place drill, driven through a real TanStack v9 table. Expected rows, counts and orders are
 * written out by hand from the shared fixture's six rows, or computed from its fixture data.
 */
import { createRef, useState } from "react";
import type { ComponentProps } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  active,
  CalendarStandIn,
  captureActions,
  flipsIn,
  focusIs,
  menuOpen,
  Orders,
  ORDERS,
  PRODUCTS,
  FIELDS,
  FIELDS_WITH_PRODUCT,
  FIELDS_WITH_RUSH,
  FIELDS_WITH_RUSH_TOGGLE,
  finishMotion,
  columnFilters,
  CUSTOMER_NORD,
  STATUS_THREE,
  freezeToday,
  renderCounted,
  renderOrders,
  settled,
  visibleOrders,
  watchSides,
} from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { glidePointerTo, turnWheel } from "../../../test/pointer-press";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { useDataTableFilter } from "./data-table-filter";
import type { FilterFieldMap } from "./filter-fields";
import { parseColumnFilters } from "./filter-parse";
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

/** Whether a field's value submenu, a dialog named after the field, is in the page. */
function submenuOpen(field: string): boolean {
  return page.getByRole("dialog", { name: field }).query() !== null;
}

/** The menu's step, the field list or an editor. */
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

  it("closes only the submenu on ArrowLeft, back to the search with its row lit", async () => {
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
    renderOrders({ initial: [], fields: FIELDS_WITH_PRODUCT });
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
    renderOrders({ initial: [], fields: FIELDS_WITH_PRODUCT });
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
    await finishMotion();
    expect(page.getByRole("dialog", { name: "Customer" }).query()).toBeNull();
    // The menu opens on its field list, so Customer gives way to no field, then to the drill.
    expect(seen).toEqual(["customer", null, "amount"]);
  });

  describe("edit() while the menu closes", () => {
    const { Capture, act } = captureActions();

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
      // Ends the stretched open zoom, which Playwright's press would otherwise wait out.
      await finishMotion();
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
        await finishMotion();
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
      await finishMotion();
      // The field list is open, so no field is active.
      expect(seen.at(-1) ?? null).toBeNull();
      await userEvent.keyboard("{Escape}");
      await finishMotion();
      expect(menuOpen()).toBe(false);
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
    await finishMotion();
    expect(page.getByRole("dialog", { name: "Amount" }).query()).toBeNull();
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

describe("DataTableFilter date presets a field chooses", () => {
  // Today is Monday 2026-10-12, the day order 3 was created. Orders 1 and 2 are earlier in
  // October, 4 is from September, and 5 and 6 are a week later.
  const CHOSEN: FilterFieldMap = {
    ...FIELDS,
    created: { kind: "date", label: "Created", presets: ["yesterday", "thisWeek", "lastWeek", "lastMonth"] },
  };

  /** The drilled date editor's preset names, in order, in its group of this name. */
  function presetNames(group = "Quick ranges"): string[] {
    return page
      .elementLocator(roleNamed("group", group))
      .getByRole("button")
      .elements()
      .map((button) => button.textContent);
  }

  /** Freezes today, renders the fields in en-US, and drills the add menu into Created. */
  async function drillCreated(fields: FilterFieldMap): Promise<void> {
    freezeToday();
    renderOrders({ initial: [], fields });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(step).toBe("editor");
  }

  /** The `columnFilters` of one date filter on Created. */
  function createdFilter(operator: "is" | "isBetween", values: readonly string[]): ColumnFiltersState {
    return [{ id: "created", value: { kind: "date", operator, values } }];
  }

  it("lists a field's presets in its order, and writes This week from Sunday in en-US", async () => {
    await drillCreated(CHOSEN);
    expect(presetNames()).toEqual(["Yesterday", "This week", "Last week", "Last month"]);
    await userEvent.click(roleNamed("button", "This week"));
    await expect.poll(menuOpen).toBe(false);
    const expected = createdFilter("isBetween", ["2026-10-11", "2026-10-17"]);
    expect(columnFilters()).toEqual(expected);
    expect(visibleOrders()).toBe("3");
    expect(parseColumnFilters(columnFilters(), CHOSEN)).toEqual(expected);
  });

  it("writes This week from Monday in nb-NO", async () => {
    freezeToday();
    renderOrders({ initial: [], fields: CHOSEN }, "nb-NO");
    await userEvent.click(roleNamed("button", "Filter"));
    await expect.poll(() => focusIs("searchbox", "Søk i felt")).toBe(true);
    await userEvent.click(roleNamed("menuitem", "Created"));
    await expect.poll(() => focusIs("button", "I går")).toBe(true);
    expect(presetNames("Hurtigvalg")).toEqual(["I går", "Denne uken", "Forrige uke", "Forrige måned"]);
    await userEvent.click(roleNamed("button", "Denne uken"));
    const expected = createdFilter("isBetween", ["2026-10-12", "2026-10-18"]);
    await expect.poll(columnFilters).toEqual(expected);
    expect(parseColumnFilters(columnFilters(), CHOSEN)).toEqual(expected);
  });

  it("shows no presets for an empty list, and keeps the date inputs", async () => {
    await drillCreated({ ...FIELDS, created: { kind: "date", label: "Created", presets: [] } });
    expect(page.getByRole("group", { name: "Quick ranges" }).query()).toBeNull();
    expect(page.getByLabelText("From", { exact: true }).query()).not.toBeNull();
    expect(page.getByLabelText("To", { exact: true }).query()).not.toBeNull();
  });

  it("writes a one-day preset as is on a field without isBetween, and leaves out the others", async () => {
    const fields: FilterFieldMap = {
      ...FIELDS,
      created: {
        kind: "date",
        label: "Created",
        operators: ["is", "isBefore"],
        presets: ["today", "yesterday", "lastWeek"],
      },
    };
    await drillCreated(fields);
    expect(presetNames()).toEqual(["Today", "Yesterday"]);
    await userEvent.click(roleNamed("button", "Yesterday"));
    await expect.poll(menuOpen).toBe(false);
    // No order was created on Sunday 2026-10-11.
    const expected = createdFilter("is", ["2026-10-11"]);
    expect(columnFilters()).toEqual(expected);
    expect(visibleOrders()).toBe("");
    expect(parseColumnFilters(columnFilters(), fields)).toEqual(expected);
  });

  it("presses This month for a filter over the whole month", async () => {
    freezeToday();
    renderOrders({ initial: createdFilter("isBetween", ["2026-10-01", "2026-10-31"]) });
    await userEvent.click(roleNamed("button", "Oct 1\u2009–\u200931, 2026"));
    await expect.poll(() => page.getByRole("dialog", { name: "Created" }).query()).not.toBeNull();
    expect(roleNamed("button", "This month").getAttribute("aria-pressed")).toBe("true");
    expect(roleNamed("button", "Last 7 days").getAttribute("aria-pressed")).toBe("false");
  });

  it("shows a preset listed twice once, at its first place", async () => {
    await drillCreated({
      ...FIELDS,
      created: { kind: "date", label: "Created", presets: ["today", "today", "yesterday"] },
    });
    expect(presetNames()).toEqual(["Today", "Yesterday"]);
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
    const october = roleNamed("button", "October");
    // The last control scrolled into the popup's box. The wheel scrolls smoothly, and no
    // transition need outlast it, so wait for the scroll itself.
    await expect
      .poll(() => october.getBoundingClientRect().bottom <= popup.getBoundingClientRect().bottom)
      .toBe(true);
    await settled();
    const box = october.getBoundingClientRect();
    // A press there reaches it.
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
  // en-US names are read by every other test here. One locale per dictionary shape is enough to
  // show the menu reads its names from the locale's dictionary: nb-NO's plain strings, fi-FI's
  // differently worded interpolation.
  it.each(["nb-NO", "fi-FI"] as const)("names the menu, its searches and Back in %s", async (locale) => {
    const names = {
      "nb-NO": ["Filter", "Legg til filter", "Søk i felt", "Søk i Status", "Tilbake til felt"],
      "fi-FI": ["Suodata", "Lisää suodatin", "Hae kenttiä", "Hae: Status", "Takaisin kenttiin"],
    } as const satisfies Partial<Record<SupportedLocale, readonly [string, string, string, string, string]>>;
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

// Rush over the six rows: orders 1, 3 and 6 are rush, 2 and 4 are not, and 5 has no value.
const RUSH_TRUE = [{ id: "rush", value: { kind: "boolean", operator: "is", values: [true] } }];
const RUSH_FALSE = [{ id: "rush", value: { kind: "boolean", operator: "is", values: [false] } }];

describe("DataTableFilter boolean fields", () => {
  it("lists Yes and No with their counts, where a missing cell counts as neither", async () => {
    renderOrders({ initial: [], fields: FIELDS_WITH_RUSH });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Rush"));
    await expect.poll(() => submenuOpen("Rush")).toBe(true);
    expect(
      page
        .elementLocator(roleNamed("dialog", "Rush"))
        .getByRole("menuitemcheckbox")
        .elements()
        .map((row) => row.textContent)
    ).toEqual(["Yes3", "No2"]);
  });

  it("writes No, then Yes in its place, one write each", async () => {
    const { writes } = renderCounted((onColumnFiltersChange) => (
      <Orders initial={[]} fields={FIELDS_WITH_RUSH} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Rush"));
    await expect.poll(() => submenuOpen("Rush")).toBe(true);
    await userEvent.click(roleNamed("menuitemcheckbox", "No"));
    await expect.poll(columnFilters).toEqual(RUSH_FALSE);
    expect(parseColumnFilters(columnFilters(), FIELDS_WITH_RUSH)).toEqual(RUSH_FALSE);
    expect(visibleOrders()).toBe("2 4");
    await userEvent.click(roleNamed("menuitemcheckbox", "Yes"));
    await expect.poll(columnFilters).toEqual(RUSH_TRUE);
    expect(visibleOrders()).toBe("1 3 6");
    expect(writes()).toBe(2);
    expect(roleNamed("combobox", "Rush operator").textContent).toBe("is");
    expect(
      page.elementLocator(roleNamed("group", "Rush filter")).getByRole("button", { name: "Yes" }).query()
    ).not.toBeNull();
  });

  it("lists Yes and No in the chip's value popover, where a pick of the applied value removes the filter", async () => {
    renderOrders({ initial: RUSH_TRUE, fields: FIELDS_WITH_RUSH });
    await userEvent.click(roleNamed("button", "Yes"));
    await expect.poll(() => page.getByRole("dialog", { name: "Rush" }).query()).not.toBeNull();
    const dialog = page.elementLocator(roleNamed("dialog", "Rush"));
    expect(
      dialog
        .getByRole("option")
        .elements()
        .map((option) => option.textContent)
    ).toEqual(["Yes3", "No2"]);
    await userEvent.click(dialog.getByRole("option", { name: "Yes" }).element());
    await expect.poll(columnFilters).toEqual([]);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });
});

describe("DataTableFilter toggles", () => {
  /** The toggle's chip, a group named after the field. */
  function chip(): HTMLElement {
    return roleNamed("group", "Rush only filter");
  }

  /** The switch at the end of the toggle's row. */
  function rowSwitch(): Element | null {
    // DOM audit: the switch is a picture of the row's state, hidden from assistive technology, so
    // no role or name reaches it.
    return roleNamed("menuitemcheckbox", "Rush only").querySelector(
      "[data-slot=data-table-filter-toggle-switch]"
    );
  }

  /** An element's checked face: `on` for `data-checked`, `off` for `data-unchecked`. */
  function face(element: Element | null | undefined): string {
    if (element === null || element === undefined) {
      return "missing";
    }
    if (element.hasAttribute("data-checked")) {
      return "on";
    }
    return element.hasAttribute("data-unchecked") ? "off" : "neither";
  }

  /** The switch's track and thumb faces. */
  function switchFaces(): readonly [track: string, thumb: string] {
    const track = rowSwitch();
    return [face(track), face(track?.firstElementChild)];
  }

  it("is one checkbox row in the field list, with the count of the rows it keeps", async () => {
    renderOrders({ initial: [], fields: FIELDS_WITH_RUSH_TOGGLE });
    await openMenu();
    const row = roleNamed("menuitemcheckbox", "Rush only");
    expect(row.getAttribute("aria-checked")).toBe("false");
    expect(row.textContent).toBe("Rush only3");
    // The row ends with a switch drawn off, after the count, with no role or focus of its own.
    expect(switchFaces()).toEqual(["off", "off"]);
    const track = rowSwitch();
    expect(row.lastElementChild).toBe(track);
    expect(track?.previousElementSibling?.getAttribute("data-slot")).toBe("data-table-filter-count");
    expect(
      [track, track?.firstElementChild].map((part) => [
        part?.getAttribute("aria-hidden") ?? null,
        part?.getAttribute("role") ?? null,
        part?.getAttribute("tabindex") ?? null,
      ])
    ).toEqual([
      ["true", null, null],
      ["true", null, null],
    ]);
  });

  it("ticks on with the menu still open, as a chip that is its name and Remove, and ticks off again", async () => {
    renderOrders({ initial: [], fields: FIELDS_WITH_RUSH_TOGGLE });
    await openMenu();
    await userEvent.click(roleNamed("menuitemcheckbox", "Rush only"));
    await expect.poll(columnFilters).toEqual(RUSH_TRUE);
    expect(visibleOrders()).toBe("1 3 6");
    expect(menuOpen()).toBe(true);
    await expect
      .poll(() => roleNamed("menuitemcheckbox", "Rush only").getAttribute("aria-checked"))
      .toBe("true");
    expect(switchFaces()).toEqual(["on", "on"]);
    expect(page.elementLocator(chip()).getByRole("combobox").query()).toBeNull();
    expect(
      page
        .elementLocator(chip())
        .getByRole("button")
        .elements()
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["Remove Rush only filter"]);
    await userEvent.click(roleNamed("menuitemcheckbox", "Rush only"));
    await expect.poll(columnFilters).toEqual([]);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
    await expect.poll(switchFaces).toEqual(["off", "off"]);
  });

  it("states a value it no longer admits in full, and a tick replaces it with on", async () => {
    renderOrders({ initial: RUSH_FALSE, fields: FIELDS_WITH_RUSH_TOGGLE });
    expect(roleNamed("combobox", "Rush only operator").textContent).toBe("is");
    expect(page.elementLocator(chip()).getByRole("button", { name: "No" }).query()).not.toBeNull();
    await openMenu();
    expect(roleNamed("menuitemcheckbox", "Rush only").getAttribute("aria-checked")).toBe("false");
    expect(switchFaces()).toEqual(["off", "off"]);
    await userEvent.click(roleNamed("menuitemcheckbox", "Rush only"));
    await expect.poll(columnFilters).toEqual(RUSH_TRUE);
    await expect.poll(switchFaces).toEqual(["on", "on"]);
  });

  it("moves focus to Remove when an operator pick turns a stale toggle on", async () => {
    renderOrders({
      initial: [{ id: "rush", value: { kind: "boolean", operator: "isNot", values: [true] } }],
      fields: FIELDS_WITH_RUSH_TOGGLE,
    });
    await userEvent.click(roleNamed("combobox", "Rush only operator"));
    await expect.poll(() => page.getByRole("option", { name: "is", exact: true }).query()).not.toBeNull();
    await userEvent.click(roleNamed("option", "is"));
    await expect.poll(columnFilters).toEqual(RUSH_TRUE);
    await expect.poll(() => focusIs("button", "Remove Rush only filter")).toBe(true);
    expect(page.elementLocator(chip()).getByRole("combobox").query()).toBeNull();
  });

  it("keeps a stale toggle's sentence while its value popover turns it on, then moves focus to Remove", async () => {
    renderOrders({ initial: RUSH_FALSE, fields: FIELDS_WITH_RUSH_TOGGLE });
    await userEvent.click(page.elementLocator(chip()).getByRole("button", { name: "No" }).element());
    await expect.poll(() => page.getByRole("dialog", { name: "Rush only" }).query()).not.toBeNull();
    await userEvent.click(
      page.elementLocator(roleNamed("dialog", "Rush only")).getByRole("option", { name: "Yes" }).element()
    );
    await expect.poll(columnFilters).toEqual(RUSH_TRUE);
    expect(page.elementLocator(chip()).getByRole("button", { name: "Yes" }).query()).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("dialog", { name: "Rush only" }).query()).toBeNull();
    await expect.poll(() => focusIs("button", "Remove Rush only filter")).toBe(true);
    expect(page.elementLocator(chip()).getByRole("combobox").query()).toBeNull();
  });

  it("shows a server's count of the rows it keeps", async () => {
    renderOrders({
      initial: [],
      manual: true,
      fields: FIELDS_WITH_RUSH_TOGGLE,
      facets: { rush: { counts: { true: 7, false: 1 } } },
    });
    await openMenu();
    expect(roleNamed("menuitemcheckbox", "Rush only").textContent).toBe("Rush only7");
  });
});
