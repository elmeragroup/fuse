import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import {
  active,
  columnFilters,
  CUSTOMER_NORD,
  FIELDS,
  finishMotion,
  Orders,
  renderOrders,
  renderCounted,
  STATUS_THREE,
  visibleOrders,
  focusIs,
  menuOpen,
  pickOption,
  FIELDS_WITH_RUSH_TOGGLE,
} from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { emulateReducedMotion } from "../../../test/reduced-motion";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import type { FilterField, FilterFieldMap } from "./filter-fields";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await emulateReducedMotion("no-preference");
  await page.viewport(414, 896);
});

describe("DataTableFilter bar", () => {
  it("names the toolbar, Trigger and chip segments, and roves them from one Tab stop with wrapping", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.keyboard("{Tab}");
    expect(active()).toBe(roleNamed("button", "Filter"));
    expect(roleNamed("group", "Status filter").contains(roleNamed("button", "Paid, Pending +1"))).toBe(true);
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

  it.each([
    [
      "Bar outside its Root",
      <DataTableFilter.Bar key="bar" />,
      "DataTableFilter.Bar must be used within DataTableFilter.Root. Wrap the filter's parts in DataTableFilter.Root.",
    ],
    [
      "Value outside a chip",
      <Orders key="value" initial={[]}>
        <CaughtError>
          <DataTableFilter.Value />
        </CaughtError>
      </Orders>,
      "DataTableFilter.Value must be used within DataTableFilter.Chip, under DataTableFilter.Chips. Render it in the chip template.",
    ],
  ])("throws a DataTableFilterCompositionError for a %s", (_label, tree, message) => {
    renderThemed(withLocale("en-US", <CaughtError>{tree}</CaughtError>));
    expect(caughtError().name).toBe("DataTableFilterCompositionError");
    expect(caughtError().message).toBe(message);
  });
});

describe("DataTableFilter editors", () => {
  it("commits text on Enter, closes and returns focus to the renamed Value", async () => {
    renderOrders({ initial: CUSTOMER_NORD });
    await userEvent.click(roleNamed("button", "“nord”"));
    const input = roleNamed("textbox", "Customer");
    await expect.poll(active).toBe(input);
    await userEvent.fill(input, "fjell");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    expect(visibleOrders()).toBe("2");
    await expect.poll(active).toBe(roleNamed("button", "“fjell”"));
  });

  it("refuses a minimum above the maximum and keeps the last valid range", async () => {
    renderOrders({
      initial: [{ id: "amount", value: { kind: "number", operator: "isBetween", values: [100, 500] } }],
    });
    await userEvent.click(roleNamed("button", "100–500"));
    await userEvent.fill(roleNamed("textbox", "Minimum"), "950");
    // Tab blurs Minimum onto Maximum, which commits it and keeps the popover open.
    await userEvent.keyboard("{Tab}");
    await expect.element(page.getByText("The minimum is above the maximum.")).toBeInTheDocument();
    expect(visibleOrders()).toBe("1 2 5");

    await userEvent.fill(roleNamed("textbox", "Minimum"), "300");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    expect(columnFilters()).toEqual([
      { id: "amount", value: { kind: "number", operator: "isBetween", values: [300, 500] } },
    ]);
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
    expect(roleNamed("button", "510")).toBeTruthy();
  });

  it("applies a typed date on blur and a preset that closes the editor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
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
    // Tab steps through a native date input's own fields, so the test blurs it.
    to.element().blur();
    await expect.poll(visibleOrders).toBe("1 2 3");

    await userEvent.click(roleNamed("button", "Today"));
    await expect.poll(() => page.getByRole("dialog").query()).toBeNull();
    // Today is 2026-10-12, the day order 3 was created.
    expect(visibleOrders()).toBe("3");
  });
});

describe("DataTableFilter removal and focus", () => {
  it("clears every filter from the bar, moves focus to the Trigger and then renders no Clear", async () => {
    renderOrders({ initial: [...STATUS_THREE, ...CUSTOMER_NORD] });
    await userEvent.click(roleNamed("button", "Clear filters"));
    await expect.poll(active).toBe(roleNamed("button", "Filter"));
    expect(page.getByRole("button", { name: "Clear filters" }).query()).toBeNull();
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
  });
});

describe("DataTableFilter value popover", () => {
  it("returns focus to the chip's Value when the editor closes", async () => {
    renderOrders({ initial: STATUS_THREE });
    await userEvent.click(roleNamed("button", "Paid, Pending +1"));
    await expect.poll(active).toBe(roleNamed("combobox", "Search Status"));
    await userEvent.keyboard("{Escape}");
    await expect.poll(active).toBe(roleNamed("button", "Paid, Pending +1"));
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
});

describe("DataTableFilter composition", () => {
  /** The fixture's fields with one field replaced. */
  function withField(id: string, field: FilterField): FilterFieldMap {
    return { ...FIELDS, [id]: field };
  }

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
});

describe("menu", () => {
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
        {
          id: "created",
          value: { kind: "date", operator: "isBetween", values: ["2026-09-13", "2026-10-12"] },
        },
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
});
