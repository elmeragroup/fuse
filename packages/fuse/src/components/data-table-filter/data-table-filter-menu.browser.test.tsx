import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import {
  active,
  focusIs,
  menuOpen,
  pickOption,
  FIELDS_WITH_RUSH_TOGGLE,
  columnFilters,
  renderOrders,
  visibleOrders,
} from "../../../test/data-table-filter-fixture";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { roleNamed } from "../../../test/themed-browser-render";

afterEach(async () => {
  await emulateReducedMotion("no-preference");
  await page.viewport(414, 896);
});

async function openMenu(): Promise<void> {
  await userEvent.click(roleNamed("button", "Filter"));
  await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
}

describe("DataTableFilter add menu", () => {
  it("opens a dialog of field rows in config order, and ticks values live with the menu open", async () => {
    renderOrders({ initial: [] });
    await openMenu();
    const trigger = roleNamed("button", "Filter");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(
      page
        .getByRole("menuitem")
        .elements()
        .map((row) => row.textContent)
    ).toEqual(["Status", "Tags", "Customer", "Amount", "Created"]);
    expect(roleNamed("menuitem", "Status").getAttribute("aria-haspopup")).toBe("dialog");

    await userEvent.click(roleNamed("menuitem", "Status"));
    await userEvent.click(page.getByRole("menuitemcheckbox", { name: "Paid" }));
    await expect.poll(visibleOrders).toBe("1 3");
    expect(roleNamed("menuitemcheckbox", "Paid").getAttribute("aria-checked")).toBe("true");
    expect(menuOpen()).toBe(true);
  });

  it("applies a date preset and closes the menu with focus on the Trigger", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    renderOrders({ initial: [] });
    await openMenu();
    await userEvent.click(roleNamed("menuitem", "Created"));
    await userEvent.click(page.getByRole("button", { name: "Last 30 days" }));
    await expect.poll(menuOpen).toBe(false);
    await expect.poll(() => focusIs("button", "Filter")).toBe(true);
    // The 30 days through 2026-10-12, written out.
    expect(columnFilters()).toEqual([
      { id: "created", value: { kind: "date", operator: "isBetween", values: ["2026-09-13", "2026-10-12"] } },
    ]);
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
});

// Rush over the six rows: orders 1, 3 and 6 are rush, 2 and 4 are not, and 5 has no value.
const RUSH_TRUE = [{ id: "rush", value: { kind: "boolean", operator: "is", values: [true] } }];
const RUSH_FALSE = [{ id: "rush", value: { kind: "boolean", operator: "is", values: [false] } }];

describe("DataTableFilter toggles", () => {
  /** The toggle's chip, a group named after the field. */
  function chip(): HTMLElement {
    return roleNamed("group", "Rush only filter");
  }

  it("moves focus to Remove when an operator pick turns a stale toggle on", async () => {
    renderOrders({
      initial: [{ id: "rush", value: { kind: "boolean", operator: "isNot", values: [true] } }],
      fields: FIELDS_WITH_RUSH_TOGGLE,
    });
    await userEvent.click(roleNamed("combobox", "Rush only operator"));
    await pickOption("is");
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
});
