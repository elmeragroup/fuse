import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
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
