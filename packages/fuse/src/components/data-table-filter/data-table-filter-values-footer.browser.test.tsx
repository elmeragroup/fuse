import type { ReactElement } from "react";

/**
 * Browser project. The values footer, Select all, Clear all and Done, in both value lists: the add
 * menu's value submenu and the chip's value popover, driven through a real TanStack v9 table.
 * Expected filters and visible orders are written out by hand from the shared fixture's six rows,
 * or computed from its fixture data.
 */
import type { ColumnFiltersState } from "@tanstack/react-table";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { CaughtError, caughtError } from "../../../test/caught-error";
import {
  columnFilters,
  CUSTOMER_NORD,
  FIELDS,
  FIELDS_WITH_RUSH,
  focusIs,
  menuOpen,
  popoverOpen,
  renderOrders,
  STATUS_THREE,
  visibleOrders,
} from "../../../test/data-table-filter-fixture";
import type { OrdersProps } from "../../../test/data-table-filter-fixture";
import { roleNamed } from "../../../test/themed-browser-render";
import type { FilterFieldMap } from "./filter-fields";
import { DataTableFilter } from "./index";

afterEach(async () => {
  await page.viewport(414, 896);
});

/** How a test composes the footer: the fields it shows on, and whether Done is disabled. */
type FooterOptions = { readonly fields?: readonly string[] | undefined; readonly doneDisabled?: boolean };

/** One footer, shared by both value lists the way the calendar demo shares its editor. */
function Footer({ fields, doneDisabled = false }: FooterOptions): ReactElement {
  return (
    <DataTableFilter.ValuesFooter fields={fields}>
      <DataTableFilter.SelectAllValues />
      <DataTableFilter.ClearValues />
      <DataTableFilter.Done disabled={doneDisabled} />
    </DataTableFilter.ValuesFooter>
  );
}

/** The kind editors with the footer under the option editor. */
function Editor(footer: FooterOptions): ReactElement {
  return (
    <DataTableFilter.Editor>
      <DataTableFilter.OptionEditor>
        <Footer {...footer} />
      </DataTableFilter.OptionEditor>
      <DataTableFilter.TextEditor />
      <DataTableFilter.NumberEditor />
      <DataTableFilter.DateEditor />
    </DataTableFilter.Editor>
  );
}

/** The bar and both overlays, each value list with the footer. */
function Composition(footer: FooterOptions): ReactElement {
  return (
    <>
      <DataTableFilter.Bar />
      <DataTableFilter.Content>
        <DataTableFilter.FieldList>
          <Footer {...footer} />
        </DataTableFilter.FieldList>
        <Editor {...footer} />
      </DataTableFilter.Content>
      <DataTableFilter.ValueContent>
        <Editor {...footer} />
      </DataTableFilter.ValueContent>
    </>
  );
}

/** Renders the fixture with the footer in both value lists. */
function renderFooter(
  initial: ColumnFiltersState,
  options: {
    readonly fieldMap?: FilterFieldMap;
    readonly footerFields?: readonly string[];
    readonly doneDisabled?: boolean;
  } = {}
): ReturnType<typeof renderOrders> {
  const props: OrdersProps = {
    initial,
    children: <Composition fields={options.footerFields} doneDisabled={options.doneDisabled ?? false} />,
    ...(options.fieldMap === undefined ? null : { fields: options.fieldMap }),
  };
  return renderOrders(props);
}

/** Opens a field's value submenu by keyboard, with focus in its search. */
async function openSubmenu(field: string): Promise<void> {
  roleNamed("button", "Filter").focus();
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => focusIs("searchbox", "Search fields")).toBe(true);
  await userEvent.keyboard(field.slice(0, 3));
  await expect.poll(() => roleNamed("menuitem", field).hasAttribute("data-highlighted")).toBe(true);
  await userEvent.keyboard("{ArrowRight}");
  await expect.poll(() => focusIs("searchbox", `Search ${field}`)).toBe(true);
}

/** The chip's Value button of a field: the chip's one button that is not its Remove. */
function chipValue(field: string): HTMLElement {
  const [value] = page
    .getByRole("group", { name: `${field} filter` })
    .getByRole("button")
    .elements()
    .filter((button) => button.getAttribute("aria-label") !== `Remove ${field} filter`);
  if (!(value instanceof HTMLElement)) {
    throw new Error(`expected ${field}'s Value`);
  }
  return value;
}

/** Opens a chip's value popover, with focus in its search. */
async function openPopover(field: string): Promise<void> {
  await userEvent.click(chipValue(field));
  await expect.poll(() => focusIs("combobox", `Search ${field}`)).toBe(true);
}

/** Whether a footer button is disabled the focusable way: announced, still in the focus order. */
function focusablyDisabled(name: string): boolean {
  const button = roleNamed("button", name);
  return button.getAttribute("aria-disabled") === "true" && !button.hasAttribute("disabled");
}

const STATUS_DRAFT: ColumnFiltersState = [
  { id: "status", value: { kind: "option", operator: "is", values: ["draft"] } },
];

describe.each(["menu", "popover"] as const)("DataTableFilter values footer in the %s", (surface) => {
  /** Opens Status's list on this surface, with focus in its search. */
  async function openStatus(): Promise<void> {
    await (surface === "menu" ? openSubmenu("Status") : openPopover("Status"));
  }

  /** Whether Status's list is open on this surface. */
  function statusOpen(): boolean {
    return surface === "menu" ? popoverOpen("Status") && menuOpen() : popoverOpen("Status");
  }

  /** Closes Status's list and opens another field's on this surface. */
  async function switchTo(field: string): Promise<void> {
    await userEvent.keyboard("{Escape}");
    if (surface === "menu") {
      await userEvent.keyboard("{Escape}");
      await expect.poll(menuOpen).toBe(false);
      await openSubmenu(field);
    } else {
      await expect.poll(() => popoverOpen("Status")).toBe(false);
      await openPopover(field);
    }
  }

  it("clears only its own field, keeps the list open and focus on Clear all, then disables it", async () => {
    renderFooter([...STATUS_THREE, ...CUSTOMER_NORD]);
    await openStatus();
    await userEvent.keyboard("{Tab}{Tab}");
    await expect.poll(() => focusIs("button", "Clear all")).toBe(true);
    await userEvent.keyboard("{Enter}");
    await expect.poll(columnFilters).toEqual(CUSTOMER_NORD);
    // Nordlys Kafé and Café Nord.
    expect(visibleOrders()).toBe("4 5");
    await expect.poll(() => focusablyDisabled("Clear all")).toBe(true);
    expect(focusIs("button", "Clear all")).toBe(true);
    expect(statusOpen()).toBe(true);
    // The list still picks: Select all after a Clear all starts the filter again.
    await userEvent.click(roleNamed("button", "Select all"));
    // The list's order, taken as it opened: the three picked then, in config order, then the rest.
    const statuses = {
      id: "status",
      value: {
        kind: "option",
        operator: "isAnyOf",
        values: ["pending", "paid", "overdue", "draft", "cancelled"],
      },
    };
    await expect.poll(columnFilters).toEqual(
      surface === "menu"
        ? [...CUSTOMER_NORD, statuses]
        : // The chip being edited keeps its place.
          [statuses, ...CUSTOMER_NORD]
    );
  });

  it("closes the list on Done and returns focus where its overlay sends it", async () => {
    renderFooter(STATUS_DRAFT);
    await openStatus();
    await userEvent.click(roleNamed("button", "Done"));
    if (surface === "menu") {
      await expect.poll(menuOpen).toBe(false);
      await expect.poll(() => focusIs("button", "Filter")).toBe(true);
    } else {
      await expect.poll(() => popoverOpen("Status")).toBe(false);
      await expect.poll(() => document.activeElement).toBe(chipValue("Status"));
    }
    expect(columnFilters()).toEqual(STATUS_DRAFT);
  });

  it("keeps a disabled Done in the focus order, where a press closes nothing", async () => {
    renderFooter(STATUS_DRAFT, { doneDisabled: true });
    await openStatus();
    await userEvent.keyboard("{Tab}{Tab}{Tab}");
    await expect.poll(() => focusIs("button", "Done")).toBe(true);
    expect(focusablyDisabled("Done")).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(statusOpen()).toBe(true);
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    await expect.poll(() => focusIs("button", "Clear all")).toBe(true);
  });

  it("leaves Select all out on a single-select field and on a boolean field", async () => {
    const fieldMap: FilterFieldMap = {
      ...FIELDS_WITH_RUSH,
      status: { ...FIELDS.status, operators: ["is", "isNot"] },
    };
    renderFooter(
      [...STATUS_DRAFT, { id: "rush", value: { kind: "boolean", operator: "is", values: [true] } }],
      { fieldMap }
    );
    await openStatus();
    expect(page.getByRole("button", { name: "Select all" }).query()).toBeNull();
    expect(page.getByRole("button", { name: "Clear all" }).query()).not.toBeNull();
    expect(page.getByRole("button", { name: "Done" }).query()).not.toBeNull();
    await switchTo("Rush");
    expect(page.getByRole("button", { name: "Select all" }).query()).toBeNull();
    await userEvent.click(roleNamed("button", "Clear all"));
    await expect.poll(columnFilters).toEqual(STATUS_DRAFT);
  });
});

describe("DataTableFilter values footer composition", () => {
  it("throws the value-list rule for a footer part outside a value list", () => {
    renderOrders({
      initial: [],
      children: (
        <CaughtError>
          <DataTableFilter.SelectAllValues />
        </CaughtError>
      ),
    });
    expect(caughtError().name).toBe("DataTableFilterCompositionError");
    expect(caughtError().message).toBe(
      "DataTableFilter.SelectAllValues must be used within a value list. Render it in DataTableFilter.FieldList's or DataTableFilter.OptionEditor's children."
    );
  });

  it("throws the unknown-field rule for a field id the Root's fields do not have", async () => {
    renderOrders({
      initial: [],
      children: (
        <>
          <DataTableFilter.Bar />
          <DataTableFilter.Content>
            <DataTableFilter.FieldList>
              <CaughtError>
                <DataTableFilter.ValuesFooter fields={["status", "region"]} />
              </CaughtError>
            </DataTableFilter.FieldList>
          </DataTableFilter.Content>
        </>
      ),
    });
    await openSubmenu("Status");
    expect(caughtError().name).toBe("DataTableFilterCompositionError");
    expect(caughtError().message).toBe(
      "DataTableFilter.ValuesFooter lists a field id that DataTableFilter.Root's fields do not have. List only ids of the fields map."
    );
  });
});
