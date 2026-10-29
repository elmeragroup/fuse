/**
 * Browser project. A real TanStack v9 table drives the filter, and every query goes through the
 * shared role and name helpers. Expected rows, counts and summaries are written out by hand from
 * the fixture below, never computed through the filter.
 */
import type { ReactElement } from "react";

import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import {
  active,
  CalendarStandIn,
  columnFilters,
  CREATED_SEPTEMBER,
  freezeToday,
  CUSTOMER_NORD,
  FIELDS,
  finishMotion,
  Orders,
  flipsIn,
  renderOrders,
  renderOrdersInFrame,
  renderOrdersInShadowRoot,
  renderCounted,
  settled,
  STATUS_THREE,
  visibleOrders,
  watchSides,
} from "../../../test/data-table-filter-fixture";
import { SUPPORTED_LOCALES, withLocale } from "../../../test/locale-matrix";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { SupportedLocale } from "../../intl/locale-context";
import { Button } from "../button/button";
import { DataTableFilterValue } from "./data-table-filter-bar";
import type { DataTableFilterOperatorProps, DataTableFilterRemoveProps } from "./data-table-filter-bar";
import { useDataTableFilter } from "./data-table-filter-context";
import { DataTableFilterCompositionError } from "./data-table-filter-error";
import type { FilterField, FilterFieldMap } from "./filter-fields";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await emulateReducedMotion("no-preference");
  await page.viewport(414, 896);
});

describe("DataTableFilter bar", () => {
  it("names the bar, the Trigger and each chip and its segments", () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    expect(roleNamed("toolbar", "Filters")).toBeTruthy();
    expect(roleNamed("button", "Filter")).toBeTruthy();
    expect(roleNamed("group", "Status filter")).toBeTruthy();
    expect(roleNamed("group", "Customer filter")).toBeTruthy();
    expect(roleNamed("combobox", "Status operator").textContent).toBe("is any of");
    expect(roleNamed("button", "Remove Status filter")).toBeTruthy();
    // Status is one of three, and the customer contains "nord": only Nordlys Kafé, overdue.
    expect(visibleOrders()).toBe("4");
  });

  it("shows two option labels and a count of the rest, and states the whole list", () => {
    renderOrders({ initial: STATUS_THREE });
    const value = roleNamed("button", "Paid, Pending +1");
    expect(value.getAttribute("aria-description")).toBe("Paid, Pending, Overdue");
  });

  it("is one Tab stop whose arrow keys rove the Trigger and every chip segment, and wrap both ways", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.keyboard("{Tab}");
    expect(active()).toBe(roleNamed("button", "Filter"));
    const order = [
      roleNamed("combobox", "Status operator"),
      roleNamed("button", "Paid, Pending +1"),
      roleNamed("button", "Remove Status filter"),
      roleNamed("combobox", "Customer operator"),
      roleNamed("button", "“nord”"),
      roleNamed("button", "Remove Customer filter"),
      roleNamed("button", "Clear filters"),
    ];
    for (const next of order) {
      await userEvent.keyboard("{ArrowRight}");
      expect(active()).toBe(next);
    }
    await userEvent.keyboard("{ArrowRight}");
    expect(active()).toBe(roleNamed("button", "Filter"));
    await userEvent.keyboard("{ArrowLeft}");
    expect(active()).toBe(roleNamed("button", "Clear filters"));
    await userEvent.keyboard("{Tab}");
    expect(roleNamed("toolbar", "Filters").contains(active())).toBe(false);
  });

  it("offers an option chip only the operators of its value count, and keeps focus on the segment", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("combobox", "Status operator"));
    const options = page
      .getByRole("option")
      .elements()
      .map((option) => option.textContent);
    expect(options).toEqual(["is any of", "is none of"]);
    await finishMotion();
    await userEvent.click(roleNamed("option", "is none of"));
    await expect.poll(() => roleNamed("combobox", "Status operator").textContent).toBe("is none of");
    // Not paid, pending or overdue, and containing "nord": only Café Nord, a draft.
    expect(visibleOrders()).toBe("5");
    await expect.poll(active).toBe(roleNamed("combobox", "Status operator"));
  });
});

describe("DataTableFilter removal and focus", () => {
  it("moves focus to the next chip, else the previous chip's last segment, else the Trigger", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Remove Status filter"));
    await expect.poll(active).toBe(roleNamed("combobox", "Customer operator"));
    expect(visibleOrders()).toBe("4 5");
    await userEvent.click(roleNamed("button", "Remove Customer filter"));
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });

  it("removes the last chip and lands on the previous chip's last segment", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Remove Customer filter"));
    await expect.poll(active).toBe(roleNamed("button", "Remove Status filter"));
  });

  it("removes a chip on Delete or Backspace from any of its segments", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    roleNamed("button", "“nord”").focus();
    await userEvent.keyboard("{Backspace}");
    await expect.poll(() => page.getByRole("group", { name: "Customer filter" }).query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("button", "Remove Status filter"));
    await userEvent.keyboard("{Delete}");
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });

  it("clears every filter from the bar, moves focus to the Trigger and then renders no Clear", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Clear filters"));
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
    expect(page.getByRole("button", { name: "Clear filters" }).query()).toBeNull();
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });

  it("clears from outside the bar as a plain button", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={STATUS_THREE}>
          <DataTableFilter.Bar />
          <DataTableFilter.ValueContent />
          <section aria-label="Empty state">
            <DataTableFilter.Clear />
          </section>
        </Orders>
      )
    );
    const region = roleNamed("region", "Empty state");
    const clear = page.elementLocator(region).getByRole("button", { name: "Clear filters" });
    await userEvent.click(clear);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
  });
});

// Inside a shadow root the document reports only the host as active, so the shadow root's own
// `activeElement` is the oracle for where focus landed.
describe("DataTableFilter in a shadow root", () => {
  it("moves focus to the next chip's first segment when the first chip is deleted", async () => {
    const shadow = renderOrdersInShadowRoot({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    roleNamed("button", "Paid, Pending +1").focus();
    await userEvent.keyboard("{Delete}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    await expect.poll(() => shadow.activeElement).toBe(roleNamed("combobox", "Customer operator"));
  });

  it("moves focus to the next chip's first segment when Escape closes an emptied chip's editor", async () => {
    const shadow = renderOrdersInShadowRoot({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await finishMotion();
    for (const option of ["Paid", "Pending", "Overdue"]) {
      await userEvent.click(roleNamed("option", option));
    }
    await expect.poll(() => roleNamed("group", "Status filter").hasAttribute("data-ghost")).toBe(true);
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    await expect.poll(() => shadow.activeElement).toBe(roleNamed("combobox", "Customer operator"));
  });
});

// Nodes in a same-origin frame belong to the frame's realm, so the frame document's own
// `activeElement` is the oracle for where focus landed.
describe("DataTableFilter in a same-origin iframe", () => {
  it("moves focus to the next chip's first segment when the first chip is deleted", async () => {
    const frameDocument = renderOrdersInFrame({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    // DOM audit: role locators stop at the frame boundary, so the segments are found by the
    // accessible names the bar gives them.
    const named = (label: string) => frameDocument.querySelector<HTMLElement>(`[aria-label="${label}"]`);
    // Keys go to the focused frame, so the frame takes focus before its segment does.
    frameDocument.defaultView?.focus();
    named("Remove Status filter")?.focus();
    expect(frameDocument.activeElement).toBe(named("Remove Status filter"));
    await userEvent.keyboard("{Delete}");
    await expect.poll(() => named("Status filter")).toBeNull();
    await expect.poll(() => frameDocument.activeElement).toBe(named("Customer operator"));
  });
});

describe("DataTableFilter value popover", () => {
  it("edits options live, flips the operator at one value, and keeps an emptied chip until it closes", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    const dialog = roleNamed("dialog", "Status");
    expect(dialog).toBeTruthy();
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    const listbox = page.elementLocator(dialog).getByRole("listbox");
    expect(listbox.element().getAttribute("aria-multiselectable")).toBe("true");

    await userEvent.click(roleNamed("option", "Overdue"));
    await expect.poll(() => page.getByRole("button", { name: "Paid, Pending" }).query()).not.toBeNull();
    // Paid or pending, containing "nord": none of the six.
    expect(visibleOrders()).toBe("");

    await userEvent.click(roleNamed("option", "Paid"));
    await expect.poll(() => roleNamed("combobox", "Status operator").textContent).toBe("is");

    await userEvent.click(roleNamed("option", "Pending"));
    // The emptied chip stays, dashed, while its editor is open.
    await expect.poll(() => roleNamed("group", "Status filter").hasAttribute("data-ghost")).toBe(true);
    expect(visibleOrders()).toBe("4 5");

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    // The ghost left, so focus goes to the next chip's first segment.
    await expect.poll(active).toBe(roleNamed("combobox", "Customer operator"));
  });

  it("orders picked values first and shows counts from the other filters", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    const dialog = roleNamed("dialog", "Status");
    const rows = page
      .elementLocator(dialog)
      .getByRole("option")
      .elements()
      .map((option) => option.textContent);
    // Picked first in config order, then the rest. Counts leave the status filter out and keep the
    // customer one: Nordlys Kafé is overdue and Café Nord is a draft.
    expect(rows).toEqual(["Pending0", "Paid0", "Overdue1", "Draft1", "Cancelled0"]);
    expect(roleNamed("option", "Overdue")).toBeTruthy();
  });

  it("returns focus to the chip's Value when the editor closes", async () => {
    renderOrders({ initial: STATUS_THREE });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    await userEvent.keyboard("{Escape}");
    await expect.poll(active).toBe(roleNamed("button", "Paid, Pending +1"));
  });

  it("moves to another chip's editor with focus in its first control", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
    await expect.poll(active).toBe(roleNamed("textbox", "Customer"));
  });

  it("hands focus to another Root's editor, and the closing editor leaves it there", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <>
          <Orders initial={STATUS_THREE} />
          {/* Below the first Root's open editor, so the press lands on the chip. */}
          <div style={{ marginTop: 400 }}>
            <Orders initial={CUSTOMER_NORD} />
          </div>
        </>
      )
    );
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => page.getByRole("dialog", { name: "Status" }).query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("textbox", "Customer"));
    expect(roleNamed("dialog", "Customer").contains(active())).toBe(true);
  });

  it("moves focus to the next chip when a press on an emptied chip's Value closes its editor", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await finishMotion();
    for (const option of ["Paid", "Pending", "Overdue"]) {
      await userEvent.click(roleNamed("option", option));
    }
    const chip = page.getByRole("group", { name: "Status filter" });
    await expect.poll(() => chip.element().hasAttribute("data-ghost")).toBe(true);
    // The chip's buttons are its Value, then its Remove.
    await userEvent.click(chip.getByRole("button").first());
    await expect.poll(() => chip.query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("combobox", "Customer operator"));
  });

  it("does not scroll the page as it opens", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingTop: "120vh", paddingBottom: "200vh" }}>
          <Orders initial={STATUS_THREE} />
        </div>
      )
    );
    const value = roleNamed("button", "Paid, Pending +1");
    value.scrollIntoView({ block: "center" });
    const before = window.scrollY;
    await userEvent.click(value);
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    expect(window.scrollY).toBe(before);
  });

  it("opens above chips by the bottom edge and holds its side and edge as it moves between them", async () => {
    // The bar's top 6rem above the viewport's bottom edge, too little room for the popover below.
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ paddingTop: "calc(100vh - 6rem)" }}>
          <Orders initial={[...STATUS_THREE, ...CUSTOMER_NORD]} />
        </div>
      )
    );
    const stop = watchSides();
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    await settled();
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
    await settled();
    const frames = stop();
    expect(window.scrollY).toBe(0);
    expect(frames.length).toBeGreaterThan(10);
    expect(flipsIn(frames)).toBe(0);
    expect(frames.at(-1)?.[0]).toBe("top");
    // Above the chips, the popover's bottom edge sits 4px over the bar's top for every chip.
    const barTop = Math.round(roleNamed("toolbar", "Filters").getBoundingClientRect().top);
    expect(frames.at(-1)?.[1]).toBe(barTop - 4);
  });
});

describe("DataTableFilter editors", () => {
  it("applies text after a pause and on Enter, which closes and returns focus", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    const input = roleNamed("textbox", "Customer");
    await expect.poll(active).toBe(input);
    await userEvent.fill(input, "bakeri");
    await expect.poll(visibleOrders).toBe("1");
    expect(page.getByRole("button", { name: "“bakeri”" }).query()).not.toBeNull();
    await userEvent.fill(input, "fjell");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    expect(visibleOrders()).toBe("2");
    await expect.poll(active).toBe(roleNamed("button", "“fjell”"));
  });

  it("commits a number on blur, refuses a minimum above the maximum, and closes on Enter", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } }],
    });
    await userEvent.click(roleNamed("button", "100–500"));
    const dialog = roleNamed("dialog", "Amount");
    const maximum = roleNamed("textbox", "Maximum");
    await userEvent.fill(maximum, "900");
    // Maximum is the editor's last control, so Tab would leave the popover and close it. Shift+Tab
    // blurs Maximum onto Minimum and keeps the popover open for the steps that follow.
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(visibleOrders).toBe("1 2 5 6");
    expect(dialog.hasAttribute("data-open")).toBe(true);

    const minimum = roleNamed("textbox", "Minimum");
    await userEvent.fill(minimum, "950");
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => page.getByText("The minimum is above the maximum.").query()).not.toBeNull();
    // The last valid range stays applied.
    expect(visibleOrders()).toBe("1 2 5 6");
    expect(dialog.hasAttribute("data-open")).toBe(true);

    await userEvent.fill(minimum, "300");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    expect(columnFilters()).toEqual([
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [300, 900] } },
    ]);
    expect(visibleOrders()).toBe("2 5 6");
  });

  it("commits a slider step from the keyboard", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [500] } }],
    });
    await userEvent.click(roleNamed("button", "500"));
    roleNamed("slider", "Amount").focus();
    await userEvent.keyboard("{ArrowRight}");
    // Above 510: Havbris Sjømat at 950 and Bryggen Bokhandel at 780.
    await expect.poll(visibleOrders).toBe("3 6");
    expect(page.getByRole("button", { name: "510" }).query()).not.toBeNull();
  });

  it("switches a number filter to one value when the header operator changes", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } }],
    });
    await userEvent.click(roleNamed("button", "100–500"));
    const dialog = page.getByRole("dialog", { name: "Amount" });
    await userEvent.click(dialog.getByRole("combobox", { name: "Amount operator" }));
    await finishMotion();
    await userEvent.click(roleNamed("option", "is at most"));
    await expect.poll(() => page.getByRole("textbox", { name: "Amount" }).query()).not.toBeNull();
    // At most 100: Nordlys Kafé at 60.
    await expect.poll(visibleOrders).toBe("4");
  });

  it("applies a date preset and closes, and applies typed dates on blur", async () => {
    freezeToday();
    renderOrders({
      initial: [
        {
          id: "created",
          value: { kind: "date", operator: "isBetween", values: ["2026-10-01", "2026-10-10"] },
        },
      ],
    });
    expect(visibleOrders()).toBe("1 2");
    await userEvent.click(roleNamed("button", "Oct 1\u2009–\u200910, 2026"));
    const to = page.getByLabelText("To", { exact: true });
    await userEvent.fill(to, "2026-10-12");
    await expect.element(to).toHaveValue("2026-10-12");
    // Tab steps through a native date input's own day, month and year fields, so the test blurs it.
    to.element().blur();
    await expect.poll(visibleOrders).toBe("1 2 3");
    // The blur leaves the popover open, so the preset press below lands in a live editor.
    expect(roleNamed("dialog", "Created").hasAttribute("data-open")).toBe(true);

    await userEvent.click(roleNamed("button", "Today"));
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    // Today is 2026-10-12, the day order 3 was created.
    expect(columnFilters()).toEqual([
      { id: "created", value: { kind: "date", operator: "isBetween", values: ["2026-10-12", "2026-10-12"] } },
    ]);
    expect(visibleOrders()).toBe("3");
  });

  it("hands a function child the range state, and keeps a completed range open", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders
          initial={[
            {
              id: "created",
              value: { kind: "date", operator: "isBetween", values: ["2026-10-01", "2026-10-10"] },
            },
          ]}>
          <DataTableFilter.Bar />
          <DataTableFilter.ValueContent>
            <DataTableFilter.Editor>
              <DataTableFilter.DateEditor>
                {(editor) => (
                  <button type="button" onClick={() => editor.onValueChange(["2026-10-12", "2026-10-20"])}>
                    {`${editor.target} ${editor.values.join("/")}`}
                  </button>
                )}
              </DataTableFilter.DateEditor>
            </DataTableFilter.Editor>
          </DataTableFilter.ValueContent>
        </Orders>
      )
    );
    await userEvent.click(roleNamed("button", "Oct 1 – 10, 2026"));
    await userEvent.click(roleNamed("button", "range 2026-10-01/2026-10-10"));
    await expect.poll(visibleOrders).toBe("3 5 6");
    expect(page.getByRole("dialog", { name: "Created" }).query()).not.toBeNull();
  });
});

describe("DataTableFilter server mode", () => {
  it("shows no counts without facets and the facets' counts with them, and filters no rows itself", async () => {
    const { unmount } = renderOrders({ initial: STATUS_THREE, manual: true });
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    const plain = page
      .getByRole("option")
      .elements()
      .map((option) => option.textContent);
    expect(plain).toEqual(["Pending", "Paid", "Overdue", "Draft", "Cancelled"]);
    unmount();

    renderOrders({
      initial: STATUS_THREE,
      manual: true,
      facets: { status: { counts: { paid: 40, draft: 2 } } },
    });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    const counted = page
      .getByRole("option")
      .elements()
      .map((option) => option.textContent);
    expect(counted).toEqual(["Pending0", "Paid40", "Overdue0", "Draft2", "Cancelled0"]);
  });
});

describe("DataTableFilter composition", () => {
  it("normalizes each field's counts once per facet change, and keeps them current", async () => {
    const reads: (ReadonlyMap<string, number> | undefined)[] = [];
    function ReadCounts() {
      const { meta } = useDataTableFilter();
      reads.push(meta.facets.counts("status"), meta.facets.counts("status"));
      return null;
    }
    const first = { status: { counts: { paid: 4, pending: 2 } } };
    const view = renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[]} manual facets={first}>
          <ReadCounts />
        </Orders>
      )
    );
    const [a, b] = reads.slice(-2);
    expect(a).toBe(b);
    expect(a === undefined ? undefined : Object.fromEntries(a)).toEqual({ paid: 4, pending: 2 });

    const second = { status: { counts: { paid: 1, overdue: 7 } } };
    view.rerender(
      withLocale(
        "en-US",
        <Orders initial={[]} manual facets={second}>
          <ReadCounts />
        </Orders>
      )
    );
    await expect.poll(() => reads.length).toBeGreaterThan(2);
    const [c, d] = reads.slice(-2);
    expect(c).toBe(d);
    expect(c === undefined ? undefined : Object.fromEntries(c)).toEqual({ paid: 1, overdue: 7 });
  });

  it("recounts a submenu's values from the other filters after a tick", async () => {
    renderOrders({ initial: [] });
    await userEvent.click(roleNamed("button", "Filter"));
    await finishMotion();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("menuitemcheckbox", { name: "Paid" }).query()).not.toBeNull();
    await userEvent.click(roleNamed("menuitemcheckbox", "Paid"));
    await expect.poll(visibleOrders).toBe("1 3");
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("dialog", { name: "Add filter" }).query()).toBeNull();
    await userEvent.click(roleNamed("button", "Filter"));
    await finishMotion();
    await userEvent.click(roleNamed("menuitem", "Tags"));
    await expect.poll(() => page.getByRole("menuitemcheckbox").elements().length).toBe(3);
    // The paid orders, 1 and 3: Priority on both, Export on order 3, Manual review on neither.
    expect(
      page
        .getByRole("menuitemcheckbox")
        .elements()
        .map((row) => row.textContent)
    ).toEqual(["Priority2", "Export1", "Manual review0"]);
  });

  /** The fixture's fields with one field replaced. */
  function withField(id: string, field: FilterField): FilterFieldMap {
    return { ...FIELDS, [id]: field };
  }

  const WITHOUT_PAID = withField("status", {
    ...FIELDS.status,
    options: FIELDS.status.options.filter((option) => option.value !== "paid"),
  });
  const PAID: ColumnFiltersState = [
    { id: "status", value: { kind: "option", operator: "is", values: ["paid"] } },
  ];

  it("keeps an applied option visible, clearable and removable after its option leaves the config", async () => {
    const view = renderThemed(withLocale("en-US", <Orders initial={PAID} fields={FIELDS} />));
    view.rerender(withLocale("en-US", <Orders initial={PAID} fields={WITHOUT_PAID} />));
    // Its raw value stands in for the label the config no longer has.
    expect(roleNamed("group", "Status filter")).toBeTruthy();
    expect(roleNamed("button", "paid")).toBeTruthy();
    expect(roleNamed("button", "Clear filters")).toBeTruthy();
    expect(visibleOrders()).toBe("1 3");
    await userEvent.click(roleNamed("button", "Remove Status filter"));
    await expect.poll(columnFilters).toEqual([]);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });

  it("removes a filter none of whose options are left in one write on an operator pick on its chip", async () => {
    let writes = 0;
    const count = () => {
      writes += 1;
    };
    const view = renderThemed(
      withLocale("en-US", <Orders initial={PAID} fields={FIELDS} onColumnFiltersChange={count} />)
    );
    view.rerender(
      withLocale("en-US", <Orders initial={PAID} fields={WITHOUT_PAID} onColumnFiltersChange={count} />)
    );
    await userEvent.click(roleNamed("combobox", "Status operator"));
    await finishMotion();
    await userEvent.click(roleNamed("option", "is not"));
    await expect.poll(columnFilters).toEqual([]);
    expect(writes).toBe(1);
    // The chip went, and it was the only one, so focus goes to the Trigger.
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
  });

  it("clears an applied option whose option left the config", async () => {
    const view = renderThemed(withLocale("en-US", <Orders initial={PAID} fields={FIELDS} />));
    view.rerender(withLocale("en-US", <Orders initial={PAID} fields={WITHOUT_PAID} />));
    await userEvent.click(roleNamed("button", "Clear filters"));
    await expect.poll(columnFilters).toEqual([]);
  });

  it("keeps a filter visible and removable after its operator leaves the config, and shows that operator", async () => {
    const range: ColumnFiltersState = [
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } },
    ];
    const narrower = withField("amount", { kind: "number", label: "Amount", operators: ["isGreaterThan"] });
    const view = renderThemed(withLocale("en-US", <Orders initial={range} fields={FIELDS} />));
    view.rerender(withLocale("en-US", <Orders initial={range} fields={narrower} />));
    expect(roleNamed("group", "Amount filter")).toBeTruthy();
    expect(roleNamed("combobox", "Amount operator").textContent).toBe("is between");
    await userEvent.click(roleNamed("button", "Remove Amount filter"));
    await expect.poll(columnFilters).toEqual([]);
  });

  /** Renders the fixture under a write counter with the full fields, then without `paid`. */
  function renderStalePaid() {
    const counted = renderCounted((onColumnFiltersChange) => (
      <Orders initial={PAID} fields={FIELDS} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    counted.rerender((onColumnFiltersChange) => (
      <Orders initial={PAID} fields={WITHOUT_PAID} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    return counted;
  }

  it("ticks a value onto a filter whose option left the config in one write, dropping the stale value", async () => {
    const { writes } = renderStalePaid();
    await userEvent.click(roleNamed("button", "Filter"));
    await finishMotion();
    await userEvent.click(roleNamed("menuitem", "Status"));
    await expect.poll(() => page.getByRole("menuitemcheckbox", { name: "Pending" }).query()).not.toBeNull();
    await userEvent.click(roleNamed("menuitemcheckbox", "Pending"));
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "status", value: { kind: "option", operator: "is", values: ["pending"] } }]);
    expect(writes()).toBe(1);
  });

  it("ticks a value from quick search onto a filter whose option left the config in one write", async () => {
    const { writes } = renderStalePaid();
    await userEvent.click(roleNamed("button", "Filter"));
    await finishMotion();
    await userEvent.keyboard("pe");
    await expect
      .poll(() => page.getByRole("menuitemcheckbox", { name: "Status Pending" }).query())
      .not.toBeNull();
    await userEvent.click(roleNamed("menuitemcheckbox", "Status Pending"));
    await expect
      .poll(columnFilters)
      .toEqual([{ id: "status", value: { kind: "option", operator: "is", values: ["pending"] } }]);
    expect(writes()).toBe(1);
  });

  it.each([
    ["the dictionary's", undefined, "is between"],
    ["a custom", (operator: string) => (operator === "isBetween" ? "within" : undefined), "within"],
  ] as const)(
    "shows a stale operator with %s label in the editor header, and edits it with an allowed operator",
    async (_label, formatOperator, shown) => {
      const range: ColumnFiltersState = [
        { id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } },
      ];
      const narrower = withField("amount", { kind: "number", label: "Amount", operators: ["isGreaterThan"] });
      const view = renderThemed(
        withLocale("en-US", <Orders initial={range} fields={FIELDS} formatOperator={formatOperator} />)
      );
      view.rerender(
        withLocale("en-US", <Orders initial={range} fields={narrower} formatOperator={formatOperator} />)
      );
      const [value] = page.elementLocator(roleNamed("group", "Amount filter")).getByRole("button").elements();
      if (value === undefined) {
        throw new Error("expected the Amount chip's Value");
      }
      await userEvent.click(value);
      await expect.poll(() => page.getByRole("textbox", { name: "Minimum" }).query()).not.toBeNull();
      const dialog = page.elementLocator(roleNamed("dialog", "Amount"));
      expect(dialog.getByRole("combobox", { name: "Amount operator" }).element().textContent).toBe(shown);
      await userEvent.fill(roleNamed("textbox", "Minimum"), "200");
      await userEvent.keyboard("{Enter}");
      await expect
        .poll(columnFilters)
        .toEqual([{ id: "amount", value: { kind: "number", operator: "isGreaterThan", values: [200] } }]);
    }
  );

  it("relabels an operator on one field through the field id formatOperator receives", async () => {
    renderOrders({
      initial: [...STATUS_THREE, ...CUSTOMER_NORD],
      formatOperator: (_operator, _kind, fieldId) => (fieldId === "customer" ? "has" : undefined),
    });
    expect(roleNamed("combobox", "Customer operator").textContent).toBe("has");
    expect(roleNamed("combobox", "Status operator").textContent).toBe("is any of");
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
    const dialog = page.elementLocator(roleNamed("dialog", "Customer"));
    expect(dialog.getByRole("combobox", { name: "Customer operator" }).element().textContent).toBe("has");
  });

  /** Renders Status as any of three under a write counter, then restricts it to single-select. */
  function renderStaleMulti() {
    const single = withField("status", { ...FIELDS.status, operators: ["is", "isNot"] });
    const counted = renderCounted((onColumnFiltersChange) => (
      <Orders initial={STATUS_THREE} fields={FIELDS} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    counted.rerender((onColumnFiltersChange) => (
      <Orders initial={STATUS_THREE} fields={single} onColumnFiltersChange={onColumnFiltersChange} />
    ));
    return counted;
  }

  const UNTICKS = [
    [
      "a value submenu",
      async () => {
        await userEvent.click(roleNamed("button", "Filter"));
        await finishMotion();
        await userEvent.click(roleNamed("menuitem", "Status"));
        await expect
          .poll(() => page.getByRole("menuitemcheckbox", { name: "Pending" }).query())
          .not.toBeNull();
        await userEvent.click(roleNamed("menuitemcheckbox", "Pending"));
      },
    ],
    [
      "quick search",
      async () => {
        await userEvent.click(roleNamed("button", "Filter"));
        await finishMotion();
        await userEvent.keyboard("pe");
        await expect
          .poll(() => page.getByRole("menuitemcheckbox", { name: "Status Pending" }).query())
          .not.toBeNull();
        await userEvent.click(roleNamed("menuitemcheckbox", "Status Pending"));
      },
    ],
    [
      "the chip's editor",
      async () => {
        await userEvent.click(roleNamed("button", "Paid, Pending +1"));
        await expect.poll(() => page.getByRole("option", { name: "Pending" }).query()).not.toBeNull();
        await userEvent.click(roleNamed("option", "Pending"));
      },
    ],
  ] as const;

  it.each(UNTICKS)(
    "removes a stale multi-selection in one write when a value is unticked in %s of a single-select field",
    async (_place, untick) => {
      const { writes } = renderStaleMulti();
      await untick();
      await expect.poll(columnFilters).toEqual([]);
      expect(writes()).toBe(1);
    }
  );

  /** The full chip template, with props for Operator and Remove. */
  function chipWith(
    operator: DataTableFilterOperatorProps,
    remove: DataTableFilterRemoveProps
  ): ReactElement {
    return (
      <DataTableFilter.Chip>
        <DataTableFilter.Subject />
        <DataTableFilter.Operator {...operator} />
        <DataTableFilter.Value />
        <DataTableFilter.Remove {...remove} />
      </DataTableFilter.Chip>
    );
  }

  const HIDDEN = { style: { display: "none" } } as const;
  const SPAN = { nativeButton: false, render: <span /> } as const;

  type FocusCase = readonly [
    name: string,
    customer: ReactElement,
    status: ReactElement,
    remove: "first" | "last",
    expected: () => HTMLElement,
  ];

  const FOCUS_CASES: readonly FocusCase[] = [
    [
      "skips the next chip's hidden leading segment",
      chipWith({}, {}),
      chipWith(HIDDEN, {}),
      "first",
      () => roleNamed("button", "Paid, Pending +1"),
    ],
    [
      "skips the previous chip's hidden trailing segment",
      chipWith({}, HIDDEN),
      chipWith({}, {}),
      "last",
      () => roleNamed("button", "“nord”"),
    ],
    [
      "lands on a disabled native Remove that stays focusable",
      chipWith({}, { disabled: true }),
      chipWith({}, {}),
      "last",
      () => roleNamed("button", "Remove Customer filter"),
    ],
    [
      "skips a disabled native Remove that is not focusable",
      chipWith({}, { disabled: true, focusableWhenDisabled: false }),
      chipWith({}, {}),
      "last",
      () => roleNamed("button", "“nord”"),
    ],
    [
      "lands on a disabled span Remove that stays focusable",
      chipWith({}, { ...SPAN, disabled: true }),
      chipWith({}, {}),
      "last",
      () => roleNamed("button", "Remove Customer filter"),
    ],
    [
      // The browser lets a script focus a disabled span Base UI renders, whatever its policy.
      "lands on a disabled span Remove under either policy, as the browser accepts focus there",
      chipWith({}, { ...SPAN, disabled: true, focusableWhenDisabled: false }),
      chipWith({}, {}),
      "last",
      () => roleNamed("button", "Remove Customer filter"),
    ],
    [
      "falls back to the Trigger when the neighbour has no segment at all",
      <DataTableFilter.Chip key="customer">
        <DataTableFilter.Subject />
      </DataTableFilter.Chip>,
      chipWith({}, {}),
      "last",
      () => roleNamed("button", "Filter"),
    ],
  ];

  it.each(FOCUS_CASES)("%s after a keyboard remove", async (_name, customer, status, remove, expected) => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              {(chip) => (chip.id === "customer" ? customer : status)}
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
      )
    );
    // Delete on a chip's Value removes it, whatever its Remove looks like.
    roleNamed("button", remove === "first" ? "“nord”" : "Paid, Pending +1").focus();
    await userEvent.keyboard("{Delete}");
    await expect
      .poll(() =>
        page.getByRole("group", { name: remove === "first" ? "Customer filter" : "Status filter" }).query()
      )
      .toBeNull();
    await expect.poll(active).toBe(expected());
  });

  it("moves focus to the previous chip's Remove, focusable only while enabled, then the Trigger", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              <DataTableFilter.Chip>
                <DataTableFilter.Subject />
                <DataTableFilter.Remove focusableWhenDisabled={false} />
              </DataTableFilter.Chip>
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
      )
    );
    roleNamed("button", "Remove Status filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("button", "Remove Customer filter"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
  });

  it("moves focus to the previous chip's non-native Remove, then the Trigger, after keyboard removes", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              <DataTableFilter.Chip>
                <DataTableFilter.Subject />
                <DataTableFilter.Operator />
                <DataTableFilter.Value />
                <DataTableFilter.Remove nativeButton={false} render={<span />} />
              </DataTableFilter.Chip>
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent />
        </Orders>
      )
    );
    // The last chip goes first, so focus lands on the previous chip's last segment, the
    // non-native Remove.
    roleNamed("button", "Remove Status filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("group", { name: "Status filter" }).query()).toBeNull();
    await expect.poll(active).toBe(roleNamed("button", "Remove Customer filter"));
    await userEvent.keyboard("{Enter}");
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
  });

  /** A span Remove that leaves the tab order once disabled. */
  const spanRemove = (
    <DataTableFilter.Remove nativeButton={false} focusableWhenDisabled={false} render={<span />} />
  );

  for (const via of ["Chip", "Bar"] as const) {
    for (const key of ["Delete", "Backspace"] as const) {
      it(`keeps a chip the ${via} disables on ${key} from its span Remove`, async () => {
        renderThemed(
          withLocale(
            "en-US",
            <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
              <DataTableFilter.Bar disabled={via === "Bar"}>
                <DataTableFilter.Trigger />
                <DataTableFilter.Chips>
                  <DataTableFilter.Chip disabled={via === "Chip"}>
                    <DataTableFilter.Subject />
                    <DataTableFilter.Operator />
                    <DataTableFilter.Value />
                    {spanRemove}
                  </DataTableFilter.Chip>
                </DataTableFilter.Chips>
              </DataTableFilter.Bar>
            </Orders>
          )
        );
        const remove = roleNamed("button", "Remove Status filter");
        remove.focus();
        expect(active()).toBe(remove);
        await userEvent.keyboard(`{${key}}`);
        await finishMotion();
        expect(page.getByRole("group", { name: "Status filter" }).query()).not.toBeNull();
        expect(columnFilters()).toEqual([...CUSTOMER_NORD, ...STATUS_THREE]);
      });
    }
  }

  it("keeps a disabled chip on Delete once focus lands on its span Remove after a neighbour goes", async () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[...CUSTOMER_NORD, ...STATUS_THREE]}>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger />
            <DataTableFilter.Chips>
              {(chip) =>
                chip.id === "status" ? (
                  <DataTableFilter.Chip disabled>
                    <DataTableFilter.Subject />
                    {spanRemove}
                  </DataTableFilter.Chip>
                ) : (
                  <DataTableFilter.Chip />
                )
              }
            </DataTableFilter.Chips>
          </DataTableFilter.Bar>
        </Orders>
      )
    );
    roleNamed("button", "Remove Customer filter").focus();
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("group", { name: "Customer filter" }).query()).toBeNull();
    // The disabled chip's only segment is its span, which still takes focus from code.
    await expect.poll(active).toBe(roleNamed("button", "Remove Status filter"));
    await userEvent.keyboard("{Delete}");
    await finishMotion();
    expect(page.getByRole("group", { name: "Status filter" }).query()).not.toBeNull();
    expect(columnFilters()).toEqual(STATUS_THREE);
  });

  it("shows the label of an unapplied draft operator the config has since left out", async () => {
    const view = renderThemed(withLocale("en-US", <Orders initial={[]} fields={FIELDS} />));
    await userEvent.click(roleNamed("button", "Filter"));
    await finishMotion();
    await userEvent.click(roleNamed("menuitem", "Amount"));
    await expect.poll(() => page.getByRole("combobox", { name: "Amount operator" }).query()).not.toBeNull();
    view.rerender(
      withLocale(
        "en-US",
        <Orders
          initial={[]}
          fields={withField("amount", { kind: "number", label: "Amount", operators: ["isGreaterThan"] })}
        />
      )
    );
    await finishMotion();
    expect(roleNamed("combobox", "Amount operator").textContent).toBe("is between");
  });

  it("names the part and the fix when a part renders outside its Root or chip", () => {
    renderThemed(
      withLocale(
        "en-US",
        <CaughtError>
          <DataTableFilter.Bar />
        </CaughtError>
      )
    );
    expect(caughtError().name).toBe("DataTableFilterCompositionError");
    expect(caughtError().message).toBe(
      "DataTableFilter.Bar must be used within DataTableFilter.Root. Wrap the filter's parts in DataTableFilter.Root."
    );
  });

  it("throws the chip rule for a Value outside a chip", () => {
    renderThemed(
      withLocale(
        "en-US",
        <Orders initial={[]}>
          <CaughtError>
            <DataTableFilterValue />
          </CaughtError>
        </Orders>
      )
    );
    expect(caughtError().message).toBe(
      "DataTableFilter.Value must be used within DataTableFilter.Chip, under DataTableFilter.Chips. Render it in the chip template."
    );
    expect(new DataTableFilterCompositionError("X", "outside-root")._tag).toBe(
      "DataTableFilterCompositionError"
    );
  });
});

describe("DataTableFilter motion and layout", () => {
  /** The value popover's positioner, which glides between chips. */
  function positioner(): HTMLElement {
    // DOM audit: the positioner has no role or name; its transition is the behaviour under test.
    const element = document.querySelector<HTMLElement>("[data-slot=data-table-filter-positioner]");
    if (element === null) {
      throw new Error("expected the value popover's positioner");
    }
    return element;
  }

  /** One painted frame of the value popover: its positioner's place and its popup's height. */
  type GlideFrame = { readonly left: number; readonly top: number; readonly height: number };

  /**
   * Moves the open popover from Status's chip to Customer's and samples every frame from the
   * press until the motion settles. The two chips sit at different places, and the option editor
   * stands taller than the text editor.
   */
  async function switchChips(): Promise<{ readonly frames: GlideFrame[]; readonly end: GlideFrame }> {
    // Wide enough that both chips fit in the strip, so the press never scrolls it to the chip.
    await page.viewport(1280, 720);
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(() => page.getByRole("dialog", { name: "Status" }).query()).not.toBeNull();
    await finishMotion();
    const read = (): GlideFrame => {
      const place = positioner().getBoundingClientRect();
      const [popup] = page.getByRole("dialog").elements();
      return { left: place.left, top: place.top, height: popup?.getBoundingClientRect().height ?? 0 };
    };
    const start = read();
    const frames: GlideFrame[] = [];
    let sampling = true;
    const sample = () => {
      frames.push(read());
      if (sampling) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
    await userEvent.click(roleNamed("button", "“nord”"));
    await expect.poll(() => page.getByRole("dialog", { name: "Customer" }).query()).not.toBeNull();
    await settled();
    sampling = false;
    const end = read();
    expect(end.left).not.toBe(start.left);
    expect(end.height).not.toBe(start.height);
    return { frames: [start, ...frames], end };
  }

  /** Whether a value lies strictly between two others. */
  function between(value: number, from: number, to: number): boolean {
    return value > Math.min(from, to) + 0.5 && value < Math.max(from, to) - 0.5;
  }

  it("glides the popover and morphs its height between chips with motion on", async () => {
    // DOM audit: the glide and the morph run on the positioner's and the popup's own 100 ms
    // transitions. Stretched to a second, a slow frame still samples the motion between its ends.
    const slow = document.createElement("style");
    slow.textContent =
      "[data-slot=data-table-filter-positioner], [data-slot=data-table-filter-value-content] { transition-duration: 1s !important; }";
    document.head.append(slow);
    onTestFinished(() => {
      slow.remove();
    });
    const { frames, end } = await switchChips();
    const [start] = frames;
    if (start === undefined) {
      throw new Error("expected a first frame");
    }
    expect(frames.some((frame) => between(frame.left, start.left, end.left))).toBe(true);
    expect(frames.some((frame) => between(frame.height, start.height, end.height))).toBe(true);
  });

  it("moves the popover between chips at once under reduced motion", async () => {
    await emulateReducedMotion("reduce");
    const { frames, end } = await switchChips();
    // The first frame that shows the popover anywhere new already shows where it ends.
    const after = frames.slice(1).find((frame) => frame.left !== frames[0]?.left);
    expect(after).toEqual(end);
  });

  it("morphs the popover's width from a calendar beside its presets to another chip's editor", async () => {
    // DOM audit: the morph runs on the popup's own 100 ms transition, stretched to a second.
    const slow = document.createElement("style");
    slow.textContent = "[data-slot=data-table-filter-value-content] { transition-duration: 1s !important; }";
    document.head.append(slow);
    onTestFinished(() => {
      slow.remove();
    });
    await page.viewport(1280, 720);
    renderOrders({
      initial: [...CREATED_SEPTEMBER, ...STATUS_THREE],
      children: (
        <>
          <DataTableFilter.Bar />
          <DataTableFilter.Content />
          <DataTableFilter.ValueContent>
            <DataTableFilter.Editor>
              <DataTableFilter.OptionEditor />
              <DataTableFilter.DateEditor>{() => <CalendarStandIn />}</DataTableFilter.DateEditor>
            </DataTableFilter.Editor>
          </DataTableFilter.ValueContent>
        </>
      ),
    });
    await userEvent.click(page.getByRole("group", { name: "Created filter" }).getByRole("button").first());
    await expect.poll(() => page.getByRole("dialog", { name: "Created" }).query()).not.toBeNull();
    await finishMotion();
    const popup = roleNamed("dialog", "Created");
    const wide = popup.getBoundingClientRect().width;
    const calendar = roleNamed("button", "Calendar").getBoundingClientRect();
    expect(wide).toBeGreaterThan(288);
    expect(calendar.left).toBeGreaterThan(roleNamed("button", "Today").getBoundingClientRect().right);
    expect(calendar.right).toBeLessThanOrEqual(popup.getBoundingClientRect().right);

    const widths: number[] = [];
    let sampling = true;
    const sample = () => {
      widths.push(popup.getBoundingClientRect().width);
      if (sampling) {
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(() => page.getByRole("dialog", { name: "Status" }).query()).not.toBeNull();
    await settled();
    sampling = false;
    expect(popup.getBoundingClientRect().width).toBe(288);
    expect(widths.some((width) => between(width, wide, 288))).toBe(true);
  });

  it.each([1280, 320])("draws the Trigger as a square icon named Filter in a %ipx bar", async (width) => {
    await page.viewport(1400, 720);
    renderThemed(
      withLocale(
        "en-US",
        <div style={{ width }}>
          <Orders initial={[...STATUS_THREE, ...CUSTOMER_NORD]} />
        </div>
      )
    );
    const trigger = roleNamed("button", "Filter");
    expect(trigger.textContent).toBe("");
    const box = trigger.getBoundingClientRect();
    expect(box.width).toBeCloseTo(box.height, 0);
  });

  it("draws a Trigger with children as a labelled button", async () => {
    await page.viewport(1280, 720);
    renderOrders({
      initial: STATUS_THREE,
      children: (
        <>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger>Add filter</DataTableFilter.Trigger>
            <DataTableFilter.Chips />
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
        </>
      ),
    });
    const box = roleNamed("button", "Add filter").getBoundingClientRect();
    expect(box.width).toBeGreaterThan(box.height);
  });

  it.each([
    ["a consumer render", { render: <Button variant="ghost" /> }],
    ["null children", { children: null }],
  ])("names a Trigger Filter when %s draws the default icon", (_case, props) => {
    renderOrders({
      initial: STATUS_THREE,
      children: (
        <>
          <DataTableFilter.Bar>
            <DataTableFilter.Trigger {...props} />
            <DataTableFilter.Chips />
          </DataTableFilter.Bar>
          <DataTableFilter.Content />
        </>
      ),
    });
    expect(roleNamed("button", "Filter").textContent).toBe("");
  });

  it.each(SUPPORTED_LOCALES)("names the chip's parts in %s", (locale) => {
    const names = {
      "en-US": ["Status filter", "Remove Status filter"],
      "nb-NO": ["Filter for Status", "Fjern filter for Status"],
      "sv-SE": ["Filter för Status", "Ta bort filter för Status"],
      "fi-FI": ["Suodatin: Status", "Poista suodatin: Status"],
    } as const satisfies Record<SupportedLocale, readonly [string, string]>;
    renderOrders({ initial: STATUS_THREE }, locale);
    const [chip, remove] = names[locale];
    expect(roleNamed("group", chip)).toBeTruthy();
    expect(roleNamed("button", remove)).toBeTruthy();
  });
});
