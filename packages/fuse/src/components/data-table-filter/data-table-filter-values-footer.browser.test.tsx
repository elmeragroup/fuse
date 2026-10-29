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
  FIELDS_WITH_PRODUCT,
  FIELDS_WITH_RUSH,
  focusIs,
  menuOpen,
  Orders,
  popoverOpen,
  PRODUCTS,
  renderOrders,
  STATUS_THREE,
  visibleOrders,
} from "../../../test/data-table-filter-fixture";
import type { OrdersProps } from "../../../test/data-table-filter-fixture";
import { withLocale } from "../../../test/locale-matrix";
import { roleNamed } from "../../../test/themed-browser-render";
import type { FilterFieldMap } from "./filter-fields";
import { parseColumnFilters } from "./filter-parse";
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

/** The Product filter's values in the table's state, or none. */
function productValues(): readonly unknown[] {
  return (
    parseColumnFilters(columnFilters(), FIELDS_WITH_PRODUCT).find((entry) => entry.id === "product")?.value
      .values ?? []
  );
}

const STONE_BOX: ColumnFiltersState = [
  { id: "product", value: { kind: "option", operator: "is", values: ["stone-box-200"] } },
];

const STATUS_DRAFT: ColumnFiltersState = [
  { id: "status", value: { kind: "option", operator: "is", values: ["draft"] } },
];

const ALL_STATUSES: ColumnFiltersState = [
  {
    id: "status",
    value: {
      kind: "option",
      operator: "isAnyOf",
      values: ["draft", "pending", "paid", "overdue", "cancelled"],
    },
  },
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

  /** A field's list search on this surface: the submenu's searchbox, or the popover's combobox. */
  function searchBox(field: string): HTMLElement {
    return roleNamed(surface === "menu" ? "searchbox" : "combobox", `Search ${field}`);
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

  /** Types into Status's list search. */
  async function search(text: string): Promise<void> {
    await userEvent.keyboard(text);
    const box = searchBox("Status");
    await expect.poll(() => box).toHaveProperty("value", text);
  }

  it("picks every option with no search, then is disabled and keeps focus and the list", async () => {
    renderFooter(STATUS_DRAFT);
    await openStatus();
    await userEvent.click(roleNamed("button", "Select all"));
    await expect.poll(columnFilters).toEqual(ALL_STATUSES);
    expect(visibleOrders()).toBe("1 2 3 4 5 6");
    await expect.poll(() => focusablyDisabled("Select all")).toBe(true);
    expect(statusOpen()).toBe(true);
    expect(focusIs("button", "Select all")).toBe(true);
  });

  it("picks every option its search matches, beside the values already picked", async () => {
    renderFooter(STATUS_DRAFT);
    await openStatus();
    // "e" matches Pending, Overdue and Cancelled, never Paid.
    await search("e");
    await userEvent.click(roleNamed("button", "Select all"));
    await expect.poll(columnFilters).toEqual([
      {
        id: "status",
        value: { kind: "option", operator: "isAnyOf", values: ["draft", "pending", "overdue", "cancelled"] },
      },
    ]);
    // Draft 5, Pending 2 and 6, Overdue 4.
    expect(visibleOrders()).toBe("2 4 5 6");
    await expect.poll(() => focusablyDisabled("Select all")).toBe(true);
    expect(statusOpen()).toBe(true);
  });

  it("keeps a negated operator negated as it grows", async () => {
    renderFooter([{ id: "status", value: { kind: "option", operator: "isNot", values: ["paid"] } }]);
    await openStatus();
    await search("pend");
    await userEvent.click(roleNamed("button", "Select all"));
    await expect
      .poll(columnFilters)
      .toEqual([
        { id: "status", value: { kind: "option", operator: "isNoneOf", values: ["paid", "pending"] } },
      ]);
    // Neither paid, 1 and 3, nor pending, 2 and 6.
    expect(visibleOrders()).toBe("4 5");
  });

  it("picks every product past the 50 shown rows, with a search and without, after the picked one", async () => {
    renderFooter(STONE_BOX, { fieldMap: FIELDS_WITH_PRODUCT });
    await (surface === "menu" ? openSubmenu("Product") : openPopover("Product"));
    const box = searchBox("Product");
    // The fixture's 25 items × 10 sizes of Oak, in config order, which the count order keeps:
    // oak-shelf-20, the one Oak product with an order, is also the first Oak product.
    const oak = PRODUCTS.filter((product) => product.label.startsWith("Oak ")).map(
      (product) => product.value
    );
    expect(oak).toHaveLength(250);
    await userEvent.fill(box, "oak");
    await userEvent.click(roleNamed("button", "Select all"));
    await expect.poll(productValues).toEqual(["stone-box-200", ...oak]);
    expect(columnFilters()).toMatchObject([{ id: "product", value: { operator: "isAnyOf" } }]);

    await userEvent.fill(box, "");
    await userEvent.click(roleNamed("button", "Select all"));
    // Then the rest in the list's order: glass-vase-30 has the most orders left, two, and every
    // other product has none and keeps config order.
    const first = new Set(["stone-box-200", ...oak, "glass-vase-30"]);
    const rest = PRODUCTS.map((product) => product.value).filter((value) => !first.has(value));
    await expect.poll(() => productValues().length).toBe(3000);
    expect(productValues()).toEqual(["stone-box-200", ...oak, "glass-vase-30", ...rest]);
    await expect.poll(() => focusablyDisabled("Select all")).toBe(true);
  });

  it("disables Select all while every option in its search is picked, and stays focusable", async () => {
    renderFooter(STATUS_THREE);
    await openStatus();
    expect(focusablyDisabled("Select all")).toBe(false);
    // "pa" matches Paid only, which STATUS_THREE picks.
    await search("pa");
    await expect.poll(() => focusablyDisabled("Select all")).toBe(true);
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => focusIs("button", "Select all")).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(columnFilters()).toEqual(STATUS_THREE);
  });

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

  it("disables Clear all while the field has no filter", async () => {
    renderFooter(surface === "menu" ? [] : STATUS_DRAFT);
    await openStatus();
    if (surface === "popover") {
      await userEvent.click(roleNamed("button", "Clear all"));
    }
    await expect.poll(() => focusablyDisabled("Clear all")).toBe(true);
    expect(focusablyDisabled("Done")).toBe(false);
  });

  it("closes the list's overlay on Done and returns focus where that overlay sends it", async () => {
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

  it("reaches the footer by Tab from the search, back by Shift+Tab, and leaves past Done", async () => {
    renderFooter(STATUS_DRAFT);
    await openStatus();
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => focusIs("button", "Select all")).toBe(true);
    expect(statusOpen()).toBe(true);
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => focusIs("button", "Clear all")).toBe(true);
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => focusIs("button", "Done")).toBe(true);
    expect(statusOpen()).toBe(true);
    await userEvent.keyboard("{Shift>}{Tab}{Tab}{Tab}{/Shift}");
    await expect.poll(() => document.activeElement).toBe(searchBox("Status"));
    expect(statusOpen()).toBe(true);
    await userEvent.keyboard("{Tab}{Tab}{Tab}{Tab}");
    if (surface === "menu") {
      await expect.poll(menuOpen).toBe(false);
      await expect.poll(() => focusIs("button", "After the bar")).toBe(true);
    } else {
      await expect.poll(() => popoverOpen("Status")).toBe(false);
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

  it("shows only on the fields it lists", async () => {
    renderFooter(
      [
        ...STATUS_DRAFT,
        { id: "tags", value: { kind: "multiOption", operator: "includes", values: ["export"] } },
      ],
      { footerFields: ["tags"] }
    );
    await openStatus();
    expect(page.getByRole("button", { name: "Done" }).query()).toBeNull();
    await switchTo("Tags");
    await expect.poll(() => page.getByRole("button", { name: "Done" }).query()).not.toBeNull();
    await userEvent.click(roleNamed("button", "Select all"));
    await expect.poll(columnFilters).toEqual([
      ...STATUS_DRAFT,
      {
        id: "tags",
        value: { kind: "multiOption", operator: "includesAnyOf", values: ["export", "priority", "manual"] },
      },
    ]);
  });

  it("disables Select all, still focusable, while the chip's operator cannot hold more values", async () => {
    // Is not paid on a field that allows is any of but not is none of.
    renderFooter([{ id: "status", value: { kind: "option", operator: "isNot", values: ["paid"] } }], {
      fieldMap: { ...FIELDS, status: { ...FIELDS.status, operators: ["is", "isNot", "isAnyOf"] } },
    });
    await openStatus();
    expect(focusablyDisabled("Select all")).toBe(true);
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => focusIs("button", "Select all")).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(columnFilters()).toEqual([
      { id: "status", value: { kind: "option", operator: "isNot", values: ["paid"] } },
    ]);
    expect(statusOpen()).toBe(true);
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

  it("keeps the footer in view under the popup's height cap while its list scrolls", async () => {
    await page.viewport(414, 420);
    renderFooter(STONE_BOX, { fieldMap: FIELDS_WITH_PRODUCT });
    await (surface === "menu" ? openSubmenu("Product") : openPopover("Product"));
    const dialog = page.getByRole("dialog", { name: "Product" });
    const popup = dialog.element();
    const list = dialog.getByRole(surface === "menu" ? "menu" : "listbox").element();
    const done = roleNamed("button", "Done");
    await expect.poll(() => list.scrollHeight > list.clientHeight).toBe(true);
    const bottom = popup.getBoundingClientRect().bottom;
    expect(done.getBoundingClientRect().bottom).toBeLessThanOrEqual(bottom);
    expect(done.getBoundingClientRect().top).toBeGreaterThanOrEqual(list.getBoundingClientRect().bottom);
    expect(done.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
  });
});

describe("DataTableFilter values footer against a changed field", () => {
  it("picks an option the host added while the popover is open", async () => {
    const view = renderFooter(ALL_STATUSES);
    await openPopover("Status");
    // Every status is picked, so nothing is left to add.
    expect(focusablyDisabled("Select all")).toBe(true);
    const refunded: FilterFieldMap = {
      ...FIELDS,
      status: {
        ...FIELDS.status,
        options: [...FIELDS.status.options, { value: "refunded", label: "Refunded" }],
      },
    };
    view.rerender(
      withLocale(
        "en-US",
        <Orders initial={ALL_STATUSES} fields={refunded}>
          <Composition />
        </Orders>
      )
    );
    await expect.poll(() => focusablyDisabled("Select all")).toBe(false);
    expect(popoverOpen("Status")).toBe(true);
    await userEvent.click(roleNamed("button", "Select all"));
    await expect.poll(columnFilters).toEqual([
      {
        id: "status",
        value: {
          kind: "option",
          operator: "isAnyOf",
          values: ["draft", "pending", "paid", "overdue", "cancelled", "refunded"],
        },
      },
    ]);
    await expect.poll(() => focusablyDisabled("Select all")).toBe(true);
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
