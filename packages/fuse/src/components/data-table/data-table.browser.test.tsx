import type { ReactElement } from "react";

/**
 * Browser project. Real TanStack v9 tables drive the plain and registered parts; every query is by
 * role and accessible name through the shared helpers.
 */
import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  filterFns,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, ColumnSizingState, Row, SortingState } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { axNodes, axProperty } from "../../../test/ax-tree";
import {
  appColumns,
  CompactTicketTable,
  features,
  NO_ORDERS,
  ORDERS,
  ORDERS_25,
  ORDERS_3,
  plainColumns,
  registeredColumns,
  renderInEnglish,
  PlainResizableTicketTable,
  ResizableAssignmentTable,
  ResizableTicketTable,
  subjectCellRenders,
  TICKET_COLUMN_SIZE,
  useFuseTable,
} from "../../../test/data-table-fixtures";
import type { Order } from "../../../test/data-table-fixtures";
import { withLocale } from "../../../test/locale-matrix";
import { whilePointerPressed } from "../../../test/pointer-press";
import { renderThemed, roleNamed, stampDensity } from "../../../test/themed-browser-render";
import { expectVisuallyHidden } from "../../../test/visually-hidden";
import { LocaleProvider } from "../../intl/locale-context";
import { Button } from "../button/button";
import { DropdownMenu } from "../dropdown-menu";
import { Frame } from "../frame/frame";
import { RadioGroup, RadioIconButton } from "../radio-group/radio-group";
import { Slider } from "../slider/slider";
import { actionsColumn } from "./actions-column";
import { createFuseTableHook } from "./create-fuse-table-hook";
import { NumberCell } from "./data-table-registered";
import type { NumberCellProps, RegisteredRowProps } from "./data-table-registered";
import { DataTable } from "./index";
import { selectColumn } from "./select-column";

function RegisteredTable({ data = ORDERS }: { readonly data?: Order[] }): ReactElement {
  const table = useFuseTable({ columns: registeredColumns, data });
  return (
    <table.AppTable>
      <table.Content />
    </table.AppTable>
  );
}

function columnHeader(name: string): HTMLElement {
  return roleNamed("columnheader", name);
}

describe("DataTable sorting", () => {
  it("renders header.SortButton and cell.NumberCell definitions, and toggles aria-sort on the sortable <th> only", async () => {
    renderInEnglish(<RegisteredTable />);

    expect(roleNamed("button", "Customer").closest("th")).toBe(columnHeader("Customer"));
    expect(roleNamed("cell", "1,234.5")).toBeInstanceOf(HTMLTableCellElement);
    expect(columnHeader("Customer").getAttribute("aria-sort")).toBe("none");
    expect(columnHeader("Amount").hasAttribute("aria-sort")).toBe(false);

    await userEvent.click(roleNamed("button", "Customer"));
    await expect
      .element(page.getByRole("columnheader", { name: "Customer" }))
      .toHaveAttribute("aria-sort", "ascending");
    expect(page.getByRole("row").elements()[1]?.textContent).toContain("Alta");

    await userEvent.click(roleNamed("button", "Customer"));
    await expect
      .element(page.getByRole("columnheader", { name: "Customer" }))
      .toHaveAttribute("aria-sort", "descending");
    expect(page.getByRole("row").elements()[1]?.textContent).toContain("Oslo");
  });
});

function ClientPagedTable({ data }: { readonly data: Order[] }): ReactElement {
  const table = useTable({
    features,
    columns: plainColumns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <>
      <DataTable.Content table={table} />
      <DataTable.Pagination table={table} />
    </>
  );
}

function button(name: string): HTMLButtonElement {
  const element = roleNamed("button", name);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`expected a <button> named ${name}`);
  }
  return element;
}

function pageButtons() {
  return {
    first: button("Go to first page"),
    previous: button("Go to previous page"),
    next: button("Go to next page"),
    last: button("Go to last page"),
  };
}

/**
 * The disabled state of the first, previous, next and last buttons. An unavailable move stays
 * focusable, so it announces `aria-disabled` instead of carrying the native attribute.
 */
function disabledMoves(): boolean[] {
  return Object.values(pageButtons()).map(
    (control) => control.disabled || control.getAttribute("aria-disabled") === "true"
  );
}

/** The pagination's page status region. */
function pageStatusRegion(): HTMLElement {
  const element = page.getByRole("status").element();
  if (!(element instanceof HTMLElement)) {
    throw new Error("expected one status region");
  }
  return element;
}

describe("DataTable pagination", () => {
  it("navigates a known total, announces it through one persistent status region, and disables the moves its position rules out", async () => {
    renderInEnglish(<ClientPagedTable data={ORDERS_25} />);

    const region = pageStatusRegion();
    expect(region.textContent).toBe("Page 1 of 3");
    expect(disabledMoves()).toEqual([true, true, false, false]);

    await userEvent.click(pageButtons().next);
    await expect.element(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
    expect(pageStatusRegion()).toBe(region);
    expect(region.textContent).toBe("Page 2 of 3");
    expect(roleNamed("cell", "Customer 11")).toBeInstanceOf(HTMLTableCellElement);

    await userEvent.click(pageButtons().last);
    await expect.element(page.getByText("Page 3 of 3", { exact: true })).toBeVisible();
    expect(disabledMoves()).toEqual([false, false, true, true]);

    await userEvent.click(pageButtons().first);
    await expect.element(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  });

  it("keeps focus on a move button that reaching the last page disables", async () => {
    renderInEnglish(<ClientPagedTable data={ORDERS_25} />);

    pageButtons().next.focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByText("Page 3 of 3", { exact: true })).toBeVisible();

    const next = pageButtons().next;
    expect(document.activeElement).toBe(next);
    expect(next.disabled).toBe(false);
    expect(next.getAttribute("aria-disabled")).toBe("true");
    // Activating the unavailable move again changes nothing.
    await userEvent.keyboard("{Enter}");
    expect(pageStatusRegion().textContent).toBe("Page 3 of 3");
  });

  it("shows an empty known total as page 1 of 1 with every move disabled", () => {
    renderInEnglish(<ClientPagedTable data={NO_ORDERS} />);

    expect(page.getByText("Page 1 of 1", { exact: true }).element()).toBeTruthy();
    expect(disabledMoves()).toEqual([true, true, true, true]);
    expect(roleNamed("cell", "No results.")).toBeInstanceOf(HTMLTableCellElement);
  });

  it("changes the page size through the labelled rows-per-page select", async () => {
    renderInEnglish(<ClientPagedTable data={ORDERS_25} />);

    await userEvent.click(roleNamed("combobox", "Rows per page"));
    // The listbox mounts after the click commits, so the locator waits for the option.
    await userEvent.click(page.getByRole("option", { name: "25", exact: true }));
    await expect.element(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
    expect(roleNamed("cell", "Customer 25")).toBeInstanceOf(HTMLTableCellElement);
  });

  it("names its controls in the provider locale", () => {
    renderThemed(withLocale("nb-NO", <ClientPagedTable data={ORDERS_25} />));

    expect(page.getByText("Side 1 av 3", { exact: true }).element()).toBeTruthy();
    expect(roleNamed("combobox", "Rader per side")).toBeInstanceOf(HTMLElement);
    expect(button("Gå til neste side").disabled).toBe(false);
  });
});

describe("DataTable registered pagination", () => {
  function SelectorTable(): ReactElement {
    const table = useFuseTable({ columns: registeredColumns, data: ORDERS_25 }, (state) => ({
      sorting: state.sorting,
    }));
    return (
      <table.AppTable>
        <table.Content />
        <table.Pagination />
      </table.AppTable>
    );
  }

  it("updates table.Pagination and table.Content when the useFuseTable selector omits pagination", async () => {
    renderInEnglish(<SelectorTable />);

    expect(page.getByText("Page 1 of 3", { exact: true }).element()).toBeTruthy();
    await userEvent.click(pageButtons().next);
    await expect.element(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("cell", { name: "Customer 11", exact: true })).toBeVisible();
  });
});

describe("DataTable registered pagination after filtering", () => {
  const filtering = createFuseTableHook({
    features: tableFeatures({
      columnFilteringFeature,
      rowPaginationFeature,
      filteredRowModel: createFilteredRowModel(),
      paginatedRowModel: createPaginatedRowModel(),
      filterFns,
    }),
  });

  const filterColumnHelper = filtering.createAppColumnHelper<Order>();
  const filterColumns = filterColumnHelper.columns([
    filterColumnHelper.accessor("customer", {
      header: "Customer",
      filterFn: "includesString",
      cell: ({ cell }) => <cell.TextCell />,
    }),
  ]);

  function FilteredTable(): ReactElement {
    // The selector omits the filters, so only the registered parts' own subscriptions re-render.
    const table = filtering.useAppTable({ columns: filterColumns, data: ORDERS_25 }, (state) => ({
      pagination: state.pagination,
    }));
    return (
      <table.AppTable>
        <button
          type="button"
          onClick={() => {
            table.getColumn("customer")?.setFilterValue("Customer 2");
          }}>
          Filter
        </button>
        <table.Content />
        <table.Pagination />
      </table.AppTable>
    );
  }

  it("follows the filtered rows, page count and moves on page index 0", async () => {
    renderInEnglish(<FilteredTable />);

    expect(page.getByText("Page 1 of 3", { exact: true }).element()).toBeTruthy();
    await userEvent.click(roleNamed("button", "Filter"));
    // "Customer 2" and "Customer 20" through "Customer 25": seven rows, one page.
    await expect.element(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
    expect(disabledMoves()).toEqual([true, true, true, true]);
    expect(page.getByRole("cell", { name: "Customer 25", exact: true }).query()).not.toBeNull();
    expect(page.getByRole("cell", { name: "Customer 1", exact: true }).query()).toBeNull();
  });
});

describe("DataTable column toggle", () => {
  const LABELS = new Map([
    ["customer", "Customer"],
    ["amount", "Amount"],
  ]);

  function ToggleTable({ data }: { readonly data: Order[] }): ReactElement {
    const table = useFuseTable({ columns: registeredColumns, data });
    return (
      <table.AppTable>
        <table.ColumnToggle getLabel={(column) => LABELS.get(column.id) ?? column.id} />
        <table.Content />
      </table.AppTable>
    );
  }

  it("hides and shows columns, and the empty row spans the visible columns", async () => {
    renderInEnglish(<ToggleTable data={[]} />);

    expect(roleNamed("cell", "No results.").getAttribute("colspan")).toBe("2");

    await userEvent.click(roleNamed("button", "Columns"));
    await userEvent.click(roleNamed("menuitemcheckbox", "Amount"));
    await expect.element(page.getByRole("columnheader", { name: "Amount" })).not.toBeInTheDocument();
    expect(roleNamed("cell", "No results.").getAttribute("colspan")).toBe("1");

    await userEvent.click(roleNamed("menuitemcheckbox", "Amount"));
    await expect.element(page.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
    expect(roleNamed("cell", "No results.").getAttribute("colspan")).toBe("2");

    // With every column hidden the table has no headers, and keeps the container's full width.
    await userEvent.click(roleNamed("menuitemcheckbox", "Customer"));
    await userEvent.click(roleNamed("menuitemcheckbox", "Amount"));
    await expect.element(page.getByRole("columnheader")).not.toBeInTheDocument();
    const table = roleNamed("cell", "No results.").closest("table");
    expect(table?.getBoundingClientRect().width).toBe(table?.parentElement?.getBoundingClientRect().width);
  });
});

describe("DataTable selection", () => {
  const selectionColumns = appColumns.columns([
    selectColumn(appColumns, { getRowLabel: (order) => `Select order ${String(order.id)}` }),
    appColumns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  ]);

  function SelectionTable(): ReactElement {
    const table = useFuseTable({
      columns: selectionColumns,
      data: ORDERS_3,
      initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    });
    return (
      <table.AppTable>
        <table.Content />
        <table.Pagination />
      </table.AppTable>
    );
  }

  function checkbox(name: string): HTMLElement {
    return roleNamed("checkbox", name);
  }

  it("gives each row checkbox its own name and scopes select-all to the page, with an indeterminate state", async () => {
    renderInEnglish(<SelectionTable />);

    expect(checkbox("Select order 1")).not.toBe(checkbox("Select order 2"));
    expect(page.getByRole("checkbox").elements()).toHaveLength(3);

    await userEvent.click(checkbox("Select order 1"));
    await expect
      .element(page.getByRole("checkbox", { name: "Select all rows on this page" }))
      .toHaveAttribute("aria-checked", "mixed");
    expect(roleNamed("checkbox", "Select order 1").closest("tr")?.getAttribute("data-state")).toBe(
      "selected"
    );

    await userEvent.click(checkbox("Select all rows on this page"));
    await expect
      .element(page.getByRole("checkbox", { name: "Select order 2" }))
      .toHaveAttribute("aria-checked", "true");
    expect(checkbox("Select all rows on this page").getAttribute("aria-checked")).toBe("true");

    await userEvent.click(pageButtons().next);
    await expect
      .element(page.getByRole("checkbox", { name: "Select order 3" }))
      .toHaveAttribute("aria-checked", "false");
    expect(checkbox("Select all rows on this page").getAttribute("aria-checked")).toBe("false");
  });
});

describe("DataTable row selection eligibility", () => {
  const eligibilityColumns = appColumns.columns([
    appColumns.display({
      id: "select",
      header: "Select",
      cell: ({ row }) => (
        <DataTable.SelectRow row={row} label={`Select order ${String(row.original.id)}`} disabled={false} />
      ),
    }),
  ]);

  function EligibilityTable(): ReactElement {
    const table = useFuseTable({
      columns: eligibilityColumns,
      data: ORDERS_3,
      enableRowSelection: (row) => row.original.id !== 2,
    });
    return (
      <table.AppTable>
        <table.Content />
      </table.AppTable>
    );
  }

  it("keeps an ineligible row's checkbox disabled under an explicit disabled={false}", () => {
    renderInEnglish(<EligibilityTable />);

    expect(roleNamed("checkbox", "Select order 2").hasAttribute("data-disabled")).toBe(true);
    expect(roleNamed("checkbox", "Select order 1").hasAttribute("data-disabled")).toBe(false);
  });
});

describe("DataTable registered row override", () => {
  const rowFeatures = tableFeatures({});

  function AppRow({ row }: RegisteredRowProps<Row<typeof rowFeatures, Order>>): ReactElement {
    return (
      <tr data-testid="app-row">
        <td>{row.original.customer}</td>
      </tr>
    );
  }

  const withRow = createFuseTableHook({ features: rowFeatures, tableComponents: { Row: AppRow } });

  const rowColumnHelper = withRow.createAppColumnHelper<Order>();
  const rowColumns = rowColumnHelper.columns([
    rowColumnHelper.accessor("customer", {
      header: "Customer",
      cell: ({ cell }) => <cell.TextCell />,
    }),
  ]);

  function OverrideTable(): ReactElement {
    const table = withRow.useAppTable({ columns: rowColumns, data: ORDERS });
    return (
      <table.AppTable>
        <table.Content />
      </table.AppTable>
    );
  }

  it("renders the default rows of table.Content through the app's registered Row", () => {
    renderInEnglish(<OverrideTable />);

    expect(roleNamed("cell", "Bergen").closest("tr")?.getAttribute("data-testid")).toBe("app-row");
  });
});

/** One pressable row of `ORDERS` over the given columns. */
function PressableTable({
  columns,
  onPress,
}: {
  readonly columns: ReadonlyArray<ColumnDef<typeof features, Order, unknown>>;
  readonly onPress: (id: number) => void;
}): ReactElement {
  const table = useFuseTable({ columns, data: ORDERS.slice(0, 1) });
  return (
    <table.AppTable>
      <table.Content>
        {(row) => (
          <table.Row
            row={row}
            onPress={() => {
              onPress(row.original.id);
            }}
          />
        )}
      </table.Content>
    </table.AppTable>
  );
}

describe("DataTable row press", () => {
  const pressColumns = appColumns.columns([
    appColumns.accessor("customer", {
      header: "Customer",
      cell: ({ cell, row }) => (
        <a href={`#order-${String(row.original.id)}`}>
          <cell.TextCell />
        </a>
      ),
    }),
    appColumns.accessor("amount", { header: "Amount", cell: ({ cell }) => <cell.NumberCell /> }),
    appColumns.display({
      id: "actions",
      header: "Actions",
      cell: () => (
        <button type="button" aria-label="Archive">
          <svg aria-hidden="true" width="16" height="16">
            <rect width="16" height="16" />
          </svg>
        </button>
      ),
    }),
  ]);

  it("fires on a cell click, ignores interactive descendants, and keeps the row role", async () => {
    const pressed: number[] = [];
    renderInEnglish(
      <PressableTable
        columns={pressColumns}
        onPress={(id) => {
          pressed.push(id);
        }}
      />
    );

    await userEvent.click(roleNamed("cell", "1,234.5"));
    expect(pressed).toEqual([1]);

    await userEvent.click(roleNamed("link", "Bergen"));
    await userEvent.click(roleNamed("button", "Archive"));
    const icon = roleNamed("button", "Archive").querySelector("svg");
    if (icon === null) {
      throw new Error("expected the Archive icon");
    }
    icon.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pressed).toEqual([1]);

    const row = roleNamed("cell", "1,234.5").closest("tr");
    expect(row?.hasAttribute("role")).toBe(false);
    expect(row?.hasAttribute("tabindex")).toBe(false);
    expect(page.getByRole("row").elements()).toContain(row);
  });
});

describe("DataTable row press past Fuse widgets and text selection", () => {
  const widgetColumns = appColumns.columns([
    appColumns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
    appColumns.display({
      id: "priority",
      header: "Priority",
      cell: () => (
        <RadioGroup label="Priority" isLabelHidden defaultValue="low" orientation="horizontal">
          <RadioIconButton value="low" aria-label="Low">
            L
          </RadioIconButton>
          <RadioIconButton value="high" aria-label="High">
            H
          </RadioIconButton>
        </RadioGroup>
      ),
    }),
    appColumns.display({
      id: "share",
      header: "Share",
      cell: () => <Slider aria-label="Share" defaultValue={0} className="w-40" />,
    }),
    appColumns.display({
      id: "note",
      header: "Note",
      cell: () => (
        <div role="textbox" aria-label="Note" contentEditable suppressContentEditableWarning>
          Call first
        </div>
      ),
    }),
  ]);

  function renderWidgets(): number[] {
    const pressed: number[] = [];
    renderInEnglish(
      <PressableTable
        columns={widgetColumns}
        onPress={(id) => {
          pressed.push(id);
        }}
      />
    );
    return pressed;
  }

  it("lets a radio, a slider and an editable region own their clicks", async () => {
    const pressed = renderWidgets();

    await userEvent.click(roleNamed("radio", "High"));
    expect(roleNamed("radio", "High").getAttribute("aria-checked")).toBe("true");

    // The slider's track has no role; a pointer press on it is what moves the thumb.
    const control = roleNamed("slider", "Share").closest("[data-slot=slider-control]");
    if (!(control instanceof HTMLElement)) {
      throw new Error("expected the slider control");
    }
    const { width, height } = control.getBoundingClientRect();
    await userEvent.click(control, { position: { x: width - 2, y: height / 2 } });
    expect(roleNamed("slider", "Share")).not.toHaveProperty("value", "0");

    await userEvent.click(roleNamed("textbox", "Note"));
    expect(pressed).toEqual([]);

    await userEvent.click(roleNamed("cell", "Bergen"));
    expect(pressed).toEqual([1]);
  });

  it("does not press a row when the click ends a text selection inside it", () => {
    const pressed = renderWidgets();
    const cell = roleNamed("cell", "Bergen");

    const selection = window.getSelection();
    selection?.selectAllChildren(cell);
    expect(selection?.isCollapsed).toBe(false);
    // A drag that selects text ends in a click on the text, with the selection still made.
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pressed).toEqual([]);

    selection?.removeAllRanges();
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pressed).toEqual([1]);
  });

  it("presses while text outside the row stays selected", () => {
    const pressed = renderWidgets();
    const selection = window.getSelection();
    selection?.selectAllChildren(roleNamed("columnheader", "Customer"));
    roleNamed("cell", "Bergen").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pressed).toEqual([1]);
    selection?.removeAllRanges();
  });
});

describe("DataTable row press through a portal", () => {
  const menuColumns = appColumns.columns([
    appColumns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
    appColumns.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            render={<Button variant="ghost" size="icon-sm" aria-label="Order actions" />}
          />
          <DropdownMenu.Content>
            <DropdownMenu.Item
              onClick={() => {
                archived.push(row.original.id);
              }}>
              Archive
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ),
    }),
  ]);

  const archived: number[] = [];

  it("runs a portaled menu item on click and on Enter without pressing the row", async () => {
    archived.length = 0;
    const pressed: number[] = [];
    renderInEnglish(
      <PressableTable
        columns={menuColumns}
        onPress={(id) => {
          pressed.push(id);
        }}
      />
    );

    await userEvent.click(roleNamed("button", "Order actions"));
    const item = roleNamed("menuitem", "Archive");
    expect(item.closest("tr")).toBeNull();
    await userEvent.click(item);
    expect(archived).toEqual([1]);
    expect(pressed).toEqual([]);

    await userEvent.click(roleNamed("button", "Order actions"));
    const again = roleNamed("menuitem", "Archive");
    again.focus();
    await userEvent.keyboard("{Enter}");
    expect(archived).toEqual([1, 1]);
    expect(pressed).toEqual([]);
  });
});

describe("DataTable row actions", () => {
  const log: string[] = [];

  const actionColumns = appColumns.columns([
    appColumns.accessor("customer", {
      header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
      cell: ({ cell }) => <cell.TextCell />,
    }),
    actionsColumn(appColumns, {
      getRowName: (order) => order.customer,
      items: (order) => (
        <>
          <DropdownMenu.Item
            onClick={() => {
              log.push(`Edited ${order.customer}`);
            }}>
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            variant="destructive"
            onClick={() => {
              log.push(`Archived ${order.customer}`);
            }}>
            Archive
          </DropdownMenu.Item>
        </>
      ),
    }),
  ]);

  function ActionsTable(): ReactElement {
    const table = useFuseTable({ columns: actionColumns, data: ORDERS });
    return (
      <table.AppTable>
        <table.ColumnToggle />
        <table.Content />
      </table.AppTable>
    );
  }

  it("names every trigger after its row, and the actions header without visible text, with no sort or hide control", async () => {
    renderInEnglish(<ActionsTable />);

    const triggers = ["Bergen", "Alta", "Oslo"].map((name) => roleNamed("button", `Actions for ${name}`));
    expect(new Set(triggers).size).toBe(3);

    const header = columnHeader("Actions");
    const name = header.firstElementChild;
    if (name === null) {
      throw new Error("expected the header's hidden name");
    }
    expectVisuallyHidden(name, "actions header name");
    expect(header.hasAttribute("aria-sort")).toBe(false);
    expect(header.querySelector("button")).toBeNull();

    await userEvent.click(roleNamed("button", "Columns"));
    await expect.element(page.getByRole("menuitemcheckbox", { name: "customer" })).toBeVisible();
    expect(page.getByRole("menuitemcheckbox").elements()).toHaveLength(1);
  });

  it("opens the menu aligned to the trigger's end and runs an item's handler", async () => {
    log.length = 0;
    renderInEnglish(<ActionsTable />);

    const trigger = roleNamed("button", "Actions for Alta");
    await userEvent.click(trigger);
    const menu = roleNamed("menu", "Actions for Alta");
    await expect.element(page.getByRole("menu")).toBeVisible();
    expect(Math.abs(menu.getBoundingClientRect().right - trigger.getBoundingClientRect().right)).toBeLessThan(
      1
    );

    await userEvent.click(roleNamed("menuitem", "Edit"));
    expect(log).toEqual(["Edited Alta"]);
  });
});

describe("DataTable registered cells", () => {
  const mistypedColumns = appColumns.columns([
    appColumns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.NumberCell /> }),
    appColumns.accessor("customer", {
      id: "placed",
      header: "Placed",
      cell: ({ cell }) => <cell.DateCell />,
    }),
  ]);

  function MistypedTable(): ReactElement {
    const table = useFuseTable({ columns: mistypedColumns, data: ORDERS.slice(0, 1) });
    return (
      <table.AppTable>
        <table.Content />
      </table.AppTable>
    );
  }

  it("renders a value of the wrong type as its raw text", () => {
    renderInEnglish(<MistypedTable />);

    expect(page.getByRole("cell", { name: "Bergen", exact: true }).elements()).toHaveLength(2);
  });
});

describe("DataTable app cell overrides", () => {
  type Invoice = { readonly amount: number; readonly placed: Date };

  const INVOICES: Invoice[] = [{ amount: 1234.5, placed: new Date(2026, 0, 15) }];

  const overrides = createFuseTableHook({
    features: tableFeatures({}),
    cellComponents: {
      NumberCell: (props: NumberCellProps) => <NumberCell maximumFractionDigits={0} {...props} />,
      DateCell: () => <span>Date withheld</span>,
    },
  });

  const invoiceColumns = overrides.createAppColumnHelper<Invoice>();

  const columns = invoiceColumns.columns([
    invoiceColumns.accessor("amount", { header: "Rounded", cell: ({ cell }) => <cell.NumberCell /> }),
    invoiceColumns.accessor("amount", {
      id: "precise",
      header: "Precise",
      cell: ({ cell }) => <cell.NumberCell maximumFractionDigits={2} />,
    }),
    invoiceColumns.accessor("placed", { header: "Placed", cell: ({ cell }) => <cell.DateCell /> }),
  ]);

  function InvoiceTable(): ReactElement {
    const table = overrides.useAppTable({ columns, data: INVOICES });
    return (
      <table.AppTable>
        <table.Content />
      </table.AppTable>
    );
  }

  it("renders the app's tweaked and replaced cells in place of Fuse's", () => {
    renderInEnglish(<InvoiceTable />);

    const cells = page
      .getByRole("cell")
      .elements()
      .map((cell) => cell.textContent);
    expect(cells).toEqual(["1,235", "1,234.5", "Date withheld"]);
  });
});

describe("DataTable date cells", () => {
  // 2026-10-01T00:00Z is still 30 September in New York and already 1 October in Tokyo.
  const MIDNIGHT_UTC = new Date(Date.UTC(2026, 9, 1));

  function DateCells(): ReactElement {
    return (
      <table>
        <tbody>
          <tr>
            <td>
              <DataTable.Date value={MIDNIGHT_UTC} />
            </td>
            <td>
              <DataTable.Date value={MIDNIGHT_UTC} timeZone="Asia/Tokyo" />
            </td>
            <td>
              <DataTable.DateTime value={MIDNIGHT_UTC} />
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  it("format in the provider's zone unless the cell names its own", () => {
    renderThemed(
      <LocaleProvider locale="nb-NO" timeZone="America/New_York">
        <DateCells />
      </LocaleProvider>
    );

    // CLDR nb: the medium date `d. MMM y`, the short time `HH:mm`, joined by `{1}, {0}`. Every space
    // is U+00A0.
    expect(
      page
        .getByRole("cell")
        .elements()
        .map((cell) => cell.textContent)
    ).toEqual(["30.\u00a0sep.\u00a02026", "1.\u00a0okt.\u00a02026", "30.\u00a0sep.\u00a02026,\u00a020:00"]);
  });
});

/**
 * A controlled column toggle and rows-per-page list: the owner's `open` decides whether each popup
 * shows, and a trigger press only reports the request.
 */
describe("DataTable controlled popups", () => {
  type OpenChange = { readonly open: boolean; readonly reason: string };

  function ControlledToggleTable({
    open,
    onChange,
  }: {
    readonly open: boolean;
    readonly onChange: (change: OpenChange) => void;
  }): ReactElement {
    const table = useFuseTable({ columns: registeredColumns, data: ORDERS_3 });
    return (
      <table.AppTable>
        <table.ColumnToggle
          open={open}
          onOpenChange={(next, details) => {
            onChange({ open: next, reason: details.reason });
          }}
        />
        <table.Content />
      </table.AppTable>
    );
  }

  function ControlledPageSizeTable({
    open,
    onChange,
  }: {
    readonly open: boolean;
    readonly onChange: (change: OpenChange) => void;
  }): ReactElement {
    const table = useTable({
      features,
      columns: plainColumns,
      data: ORDERS_25,
      initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
    });
    return (
      <DataTable.Pagination
        table={table}
        pageSizeOpen={open}
        onPageSizeOpenChange={(next, details) => {
          onChange({ open: next, reason: details.reason });
        }}
      />
    );
  }

  // Oracle: a controlled popup shows exactly when its owner's `open` is true, and a press on
  // the trigger only asks the owner, through the change callback with Base UI's reason.
  it("opens and closes table.ColumnToggle's menu from open, and reports a trigger press", async () => {
    const changes: OpenChange[] = [];
    const record = (change: OpenChange) => {
      changes.push(change);
    };
    const { rerender } = renderInEnglish(<ControlledToggleTable open onChange={record} />);
    await expect.element(page.getByRole("menu")).toBeInTheDocument();

    rerender(<ControlledToggleTable open={false} onChange={record} />);
    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();

    await userEvent.click(roleNamed("button", "Columns"));
    expect(changes).toEqual([{ open: true, reason: "trigger-press" }]);
    expect(page.getByRole("menu").query()).toBeNull();
  });

  it("opens and closes the rows-per-page list from pageSizeOpen, and reports a trigger press", async () => {
    const changes: OpenChange[] = [];
    const record = (change: OpenChange) => {
      changes.push(change);
    };
    const { rerender } = renderInEnglish(<ControlledPageSizeTable open onChange={record} />);
    await expect.element(page.getByRole("listbox")).toBeInTheDocument();

    rerender(<ControlledPageSizeTable open={false} onChange={record} />);
    await expect.element(page.getByRole("listbox")).not.toBeInTheDocument();

    await userEvent.click(roleNamed("combobox", "Rows per page"));
    expect(changes).toEqual([{ open: true, reason: "trigger-press" }]);
    expect(page.getByRole("listbox").query()).toBeNull();
  });
});

describe("DataTable column resizing", () => {
  /**
   * A recorder for a table's `onSizing` prop.
   *
   * @returns Every `columnSizing` state the table commits, in order, and the callback that records them.
   */
  function recordSizings() {
    const sizings: ColumnSizingState[] = [];
    const onSizing = (sizing: ColumnSizingState): void => {
      sizings.push(sizing);
    };
    return { sizings, onSizing };
  }

  /**
   * Renders the ticket table and waits for the handles to name their header cells.
   *
   * @param props - The ticket table's `locked` prop.
   * @returns Every `columnSizing` state the table commits, in order, and the render's `rerender`.
   */
  async function renderTickets({ locked = false }: { readonly locked?: boolean } = {}) {
    const { sizings, onSizing } = recordSizings();
    const { rerender } = renderInEnglish(<ResizableTicketTable onSizing={onSizing} locked={locked} />);
    await expect.element(page.getByRole("columnheader", { name: "Status", exact: true })).toBeInTheDocument();
    return { sizings, onSizing, rerender };
  }

  function widthOf(name: string): number {
    return columnHeader(name).getBoundingClientRect().width;
  }

  function handle(name: string): HTMLElement {
    return roleNamed("separator", `Resize ${name} column`);
  }

  /**
   * Presses a handle, moves the pointer to each of `moves`, in px right of the press, runs `during`
   * with the button held, then releases.
   */
  async function dragHandle(
    name: string,
    moves: number | readonly number[],
    during?: () => void | Promise<void>
  ): Promise<void> {
    const separator = handle(name);
    const start = separator.getBoundingClientRect();
    const container = separator.closest("[data-slot=table-container]");
    if (!(container instanceof HTMLElement)) {
      throw new Error("expected the table container");
    }
    const box = container.getBoundingClientRect();
    await userEvent.hover(separator);
    await whilePointerPressed(async () => {
      for (const dx of [moves].flat()) {
        await userEvent.hover(container, {
          position: {
            x: start.left + start.width / 2 + dx - box.left,
            y: start.top + start.height / 2 - box.top,
          },
        });
      }
      await during?.();
    });
  }

  /**
   * Listens for the next press on `element`.
   *
   * @returns A function that returns the pressing pointer's id once the press has happened.
   */
  function nextPointerId(element: HTMLElement): () => number {
    let id: number | undefined;
    element.addEventListener(
      "pointerdown",
      (event) => {
        id = event.pointerId;
      },
      { once: true }
    );
    return () => {
      if (id === undefined) {
        throw new Error("expected a press on the element");
      }
      return id;
    };
  }

  /** The value and maximum Chromium's accessibility tree exposes for a separator. */
  async function exposedRange(name: string): Promise<{ value: number; max: number }> {
    const node = (await axNodes()).find(
      (each) => each.role?.value === "separator" && each.name?.value === name
    );
    if (node === undefined) {
      throw new Error(`expected a separator named ${name} in the accessibility tree`);
    }
    return { value: Number(node.value?.value), max: Number(axProperty(node, "valuemax")) };
  }

  /** The width a handle announces, which its column must render at. */
  function announced(separator: HTMLElement): number {
    return Number(separator.getAttribute("aria-valuenow"));
  }

  // Oracle: the sizes and bounds the fixture's column definitions write by hand.
  it("names each handle after its column, reports its width and bounds, and skips a column that cannot resize", async () => {
    await renderTickets();

    const subject = handle("Subject");
    expect(subject.getAttribute("aria-orientation")).toBe("vertical");
    expect(subject.tabIndex).toBe(0);
    expect(subject.getAttribute("aria-valuenow")).toBe("160");
    expect(subject.getAttribute("aria-valuemin")).toBe("120");
    expect(subject.getAttribute("aria-valuemax")).toBe("200");
    expect(subject.getAttribute("aria-valuetext")).toBe("160 pixels");
    expect(widthOf("Subject")).toBe(announced(subject));
    // The handle's name and width stay out of the header cell's name.
    expect(subject.closest("th")).toBe(columnHeader("Subject"));

    // The handle's 32px minimum raises TanStack's default `minSize` of 20. Without a `maxSize` the
    // handle announces TanStack's resolved maximum, not ARIA's default of 100. Chromium keeps
    // range values as 32-bit floats.
    expect(handle("Status").getAttribute("aria-valuemin")).toBe("32");
    expect(handle("Status").getAttribute("aria-valuemax")).toBe(String(Number.MAX_SAFE_INTEGER));
    expect(await exposedRange("Resize Status column")).toEqual({
      value: 100,
      max: Math.fround(Number.MAX_SAFE_INTEGER),
    });

    expect(page.getByRole("separator", { name: "Resize Ticket column" }).query()).toBeNull();
    expect(widthOf("Ticket")).toBe(TICKET_COLUMN_SIZE);
    expect(page.getByRole("separator").elements()).toHaveLength(2);
  });

  // Oracle: the 10px step from the issue's keyboard model, and the fixture's 120 to 200px bounds.
  it("resizes from the keyboard within the column's bounds, and resets on double-click", async () => {
    const { sizings } = await renderTickets();
    const subject = handle("Subject");
    subject.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(subject.getAttribute("aria-valuenow")).toBe("170");
    expect(widthOf("Subject")).toBe(announced(subject));

    await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(subject.getAttribute("aria-valuenow")).toBe("150");
    expect(widthOf("Subject")).toBe(announced(subject));

    await userEvent.keyboard("{Home}");
    expect(subject.getAttribute("aria-valuenow")).toBe("120");
    await userEvent.keyboard("{ArrowLeft}");
    expect(subject.getAttribute("aria-valuenow")).toBe("120");
    expect(widthOf("Subject")).toBe(announced(subject));

    await userEvent.keyboard("{End}");
    expect(subject.getAttribute("aria-valuenow")).toBe("200");
    await userEvent.keyboard("{ArrowRight}");
    expect(subject.getAttribute("aria-valuenow")).toBe("200");
    expect(widthOf("Subject")).toBe(announced(subject));

    // A key at a bound changes nothing, so it reports nothing.
    expect(sizings).toEqual([
      { subject: 170 },
      { subject: 160 },
      { subject: 150 },
      { subject: 120 },
      { subject: 200 },
    ]);

    await userEvent.dblClick(subject);
    expect(subject.getAttribute("aria-valuenow")).toBe("160");
    expect(sizings.at(-1)).toEqual({});
  });

  it("previews a pointer drag without rendering a row, commits once on release, and leaves sorting alone", async () => {
    const { sizings } = await renderTickets();
    const subject = handle("Subject");
    const startWidth = widthOf("Subject");
    const statusWidth = widthOf("Status");
    const rendersBefore = subjectCellRenders.count;
    await dragHandle("Subject", [-15, -30], () => {
      expect(widthOf("Subject")).toBe(startWidth - 30);
      expect(widthOf("Status")).toBe(statusWidth);
      expect(subject.getAttribute("aria-valuenow")).toBe("130");
      expect(subject.getAttribute("aria-valuetext")).toBe("130 pixels");
      expect(subjectCellRenders.count).toBe(rendersBefore);
      expect(sizings).toEqual([]);
    });

    expect(sizings).toEqual([{ subject: 130 }]);
    expect(subject.getAttribute("aria-valuenow")).toBe("130");
    expect(widthOf("Subject")).toBe(announced(subject));
    expect(columnHeader("Subject").getAttribute("aria-sort")).toBe("none");
  });

  it("cuts a header wider than its column short with an ellipsis, clear of the handle", async () => {
    renderInEnglish(<ResizableAssignmentTable />);
    await expect.element(page.getByRole("columnheader", { name: "Queue", exact: true })).toBeInTheDocument();

    const sortButton = roleNamed("button", "Assigned support queue");
    const label = page.getByText("Assigned support queue", { exact: true }).element();
    expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
    expect(getComputedStyle(label).textOverflow).toBe("ellipsis");
    expect(sortButton.getBoundingClientRect().right).toBeLessThanOrEqual(
      handle("Queue").getBoundingClientRect().left
    );

    // A plain-text header cuts its text at the cell, too.
    const channel = columnHeader("Channel");
    expect(getComputedStyle(channel).overflowX).toBe("hidden");
    expect(getComputedStyle(channel).textOverflow).toBe("ellipsis");
  });

  it("previews a plain-parts drag on the dragged column alone", async () => {
    renderInEnglish(<PlainResizableTicketTable />);
    await expect.element(page.getByRole("columnheader", { name: "Status", exact: true })).toBeInTheDocument();
    const subject = handle("Subject");
    const subjectWidth = widthOf("Subject");
    const statusWidth = widthOf("Status");

    await dragHandle("Subject", -30, () => {
      expect(widthOf("Subject")).toBe(subjectWidth - 30);
      expect(widthOf("Status")).toBe(statusWidth);
    });

    expect(subject.getAttribute("aria-valuenow")).toBe("130");
    expect(widthOf("Subject")).toBe(subjectWidth - 30);
    expect(widthOf("Status")).toBe(statusWidth);
  });

  // Oracle: the header's own click handler, which a click on its label does reach.
  it("keeps the handle's clicks and double-clicks from a click-to-sort header", async () => {
    const sortings: SortingState[] = [];
    renderInEnglish(
      <PlainResizableTicketTable
        onSorting={(sorting) => {
          sortings.push(sorting);
        }}
      />
    );
    await expect
      .element(page.getByRole("columnheader", { name: "Subject", exact: true }))
      .toBeInTheDocument();

    await userEvent.click(handle("Subject"));
    await userEvent.dblClick(handle("Subject"));
    expect(sortings).toEqual([]);

    await userEvent.click(page.getByText("Subject", { exact: true }));
    expect(sortings).toEqual([[{ id: "subject", desc: false }]]);
  });

  // Oracle: a key chord with Alt, Control or Meta belongs to the browser, as in the Calendar's matching test.
  it.each([
    ["Alt+Arrow Left", { key: "ArrowLeft", altKey: true }],
    ["Control+Arrow Right", { key: "ArrowRight", ctrlKey: true }],
    ["Meta+Arrow Left", { key: "ArrowLeft", metaKey: true }],
    ["Control+Home", { key: "Home", ctrlKey: true }],
  ] as const)("leaves %s to the browser: no resize, no preventDefault", async (_keys, init) => {
    const { sizings } = await renderTickets();
    const subject = handle("Subject");
    subject.focus();
    const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
    subject.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(sizings).toEqual([]);
  });

  // Oracle: CSS clipping, which the header cells of the same table already apply.
  it.each([
    ["registered", () => <ResizableTicketTable />],
    ["plain-parts", () => <PlainResizableTicketTable />],
  ] as const)("clips a %s body cell wider than its column with an ellipsis", async (_parts, render) => {
    renderInEnglish(render());
    await expect.element(page.getByRole("columnheader", { name: "Status", exact: true })).toBeInTheDocument();
    handle("Status").focus();
    await userEvent.keyboard("{Home}");

    const cell = roleNamed("cell", "Waiting");
    expect(cell.scrollWidth).toBeGreaterThan(cell.clientWidth);
    expect(getComputedStyle(cell).overflowX).toBe("hidden");
    expect(getComputedStyle(cell).textOverflow).toBe("ellipsis");
  });

  // Oracle: ARIA needs a finite `aria-valuemax`, and TanStack reads a `maxSize` of `Infinity` as no
  // maximum, as it does its default of `Number.MAX_SAFE_INTEGER`.
  it("announces TanStack's unbounded maximum for a column whose maxSize is Infinity", async () => {
    renderInEnglish(<ResizableAssignmentTable />);
    await expect
      .element(page.getByRole("columnheader", { name: "Channel", exact: true }))
      .toBeInTheDocument();
    expect(handle("Channel").getAttribute("aria-valuemax")).toBe(String(Number.MAX_SAFE_INTEGER));
  });

  // Oracle: ARIA requires `aria-valuemin` at most `aria-valuenow`, and Arrow Left in a left-to-right
  // table narrows a column or leaves it alone.
  it("never widens a column narrower than the handle's minimum on a shrink", async () => {
    const { sizings, onSizing } = recordSizings();
    renderInEnglish(<CompactTicketTable onSizing={onSizing} />);
    await expect.element(page.getByRole("columnheader", { name: "Ticket", exact: true })).toBeInTheDocument();
    const ticket = handle("Ticket");
    const before = widthOf("Ticket");
    expect(Number(ticket.getAttribute("aria-valuemin"))).toBeLessThanOrEqual(announced(ticket));

    ticket.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(widthOf("Ticket")).toBeLessThanOrEqual(before);
    await dragHandle("Ticket", -10);
    expect(widthOf("Ticket")).toBeLessThanOrEqual(before);
    expect(sizings).toEqual([]);
  });

  // Oracle: the cell's own box. A Frame pads a table's first and last cell with its text inset, 25px at
  // comfortable density, and the fixed sizes leave room for it beside the checkbox and the trigger.
  it("fits the selection checkbox and the row-actions trigger inside their cells in a Frame", async () => {
    stampDensity("comfortable");
    renderInEnglish(
      <Frame.Root>
        <ResizableTicketTable />
        <CompactTicketTable />
      </Frame.Root>
    );
    await expect.element(page.getByRole("columnheader", { name: "Status", exact: true })).toBeInTheDocument();

    for (const control of [
      roleNamed("checkbox", "Select ticket 101"),
      roleNamed("button", "Actions for Invoice copy"),
    ]) {
      const cell = control.closest("td");
      if (cell === null) {
        throw new Error("expected the control's cell");
      }
      const inner = control.getBoundingClientRect();
      const outer = cell.getBoundingClientRect();
      expect(inner.left).toBeGreaterThanOrEqual(outer.left);
      expect(inner.right).toBeLessThanOrEqual(outer.right);
    }
  });

  // Oracle: stacking order, which `elementFromPoint` reports. A bar at `z-index: 10`, the usual value
  // for a sticky bar, stays above a table that scrolls beneath it.
  it("stays beneath a host's sticky bar that its table scrolls under", async () => {
    renderInEnglish(
      <div>
        <header data-testid="bar" style={{ position: "sticky", top: 0, zIndex: 10, height: 80 }} />
        <ResizableTicketTable />
        <div style={{ height: 2000 }} />
      </div>
    );
    await expect.element(page.getByRole("columnheader", { name: "Status", exact: true })).toBeInTheDocument();
    const bar = page.getByTestId("bar").element();
    window.scrollTo(0, 40);
    const at = handle("Subject").getBoundingClientRect();
    const hit = document.elementFromPoint(at.left + at.width / 2, at.top + at.height / 2);
    expect(at.bottom).toBeLessThan(bar.getBoundingClientRect().bottom);
    expect(hit).toBe(bar);
  });

  // Oracle: a press focuses a focusable element, so the arrow keys can follow a drag.
  it("takes focus from a pointer press", async () => {
    await renderTickets();
    await userEvent.click(handle("Subject"));
    expect(document.activeElement).toBe(handle("Subject"));
  });

  // Oracle: the app's `columnSizing`, which the locked table never changes, so the column keeps the
  // width it started at.
  it("shows the width React renders again when the app refuses a released drag", async () => {
    const { sizings } = await renderTickets({ locked: true });
    const startWidth = widthOf("Subject");

    await dragHandle("Subject", -30);

    expect(sizings).toEqual([{ subject: 130 }]);
    expect(widthOf("Subject")).toBe(startWidth);
    expect(handle("Subject").getAttribute("aria-valuenow")).toBe("160");
  });

  // Oracle: the column's committed width, which a drag that never released never changed.
  it("drops a drag's preview when resizing is turned off during it", async () => {
    const { sizings, onSizing, rerender } = await renderTickets();
    const startWidth = widthOf("Subject");

    await dragHandle("Subject", -20, async () => {
      rerender(<ResizableTicketTable onSizing={onSizing} canResize={false} />);
      await expect
        .element(page.getByRole("separator", { name: "Resize Subject column" }))
        .not.toBeInTheDocument();
      expect(widthOf("Subject")).toBe(startWidth);
    });

    expect(widthOf("Subject")).toBe(startWidth);
    expect(sizings).toEqual([]);
  });

  // Oracle: a canceled pointer ends its drag without a commit, so the column keeps its committed width.
  it("ends a drag without committing when the pointer is canceled", async () => {
    const { sizings } = await renderTickets();
    const subject = handle("Subject");
    const startWidth = widthOf("Subject");
    const pointerId = nextPointerId(subject);

    await dragHandle("Subject", -20, () => {
      subject.dispatchEvent(new PointerEvent("pointercancel", { pointerId: pointerId(), bubbles: true }));
      expect(widthOf("Subject")).toBe(startWidth);
    });

    expect(widthOf("Subject")).toBe(startWidth);
    expect(sizings).toEqual([]);
  });

  // Oracle: a handle that loses its pointer capture no longer follows the pointer, so its drag ends
  // without a commit and the column keeps its committed width.
  it("ends a drag without committing when the handle loses its pointer capture", async () => {
    const { sizings } = await renderTickets();
    const subject = handle("Subject");
    const startWidth = widthOf("Subject");
    const pointerId = nextPointerId(subject);

    await dragHandle("Subject", -20, async () => {
      subject.releasePointerCapture(pointerId());
      // The browser fires `lostpointercapture` before it dispatches the next pointer event.
      await userEvent.hover(columnHeader("Status"));
      expect(widthOf("Subject")).toBe(startWidth);
    });

    expect(widthOf("Subject")).toBe(startWidth);
    expect(sizings).toEqual([]);
  });

  // Oracle: in a right-to-left table the handle sits at the column's left edge, so Arrow Left and a
  // leftward drag move it away from the column's start and widen the column.
  it("mirrors its keys and its drag in a right-to-left table", async () => {
    const { sizings, onSizing } = recordSizings();
    renderInEnglish(
      <div dir="rtl">
        <ResizableTicketTable onSizing={onSizing} />
      </div>
    );
    await expect.element(page.getByRole("columnheader", { name: "Status", exact: true })).toBeInTheDocument();
    const subject = handle("Subject");
    subject.focus();

    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{ArrowRight}");
    await dragHandle("Subject", -20);

    expect(sizings).toEqual([{ subject: 170 }, { subject: 160 }, { subject: 180 }]);
    expect(widthOf("Subject")).toBe(announced(subject));
  });

  // Oracle: the fixture's 120 to 200px bounds for Subject, and Status, which sets no `maxSize`.
  it("stops a drag at the column's bounds, and End does nothing without a maximum", async () => {
    const { sizings } = await renderTickets();
    const subject = handle("Subject");

    await dragHandle("Subject", -60, () => {
      expect(widthOf("Subject")).toBe(Number(subject.getAttribute("aria-valuemin")));
    });
    await dragHandle("Subject", 100, () => {
      expect(widthOf("Subject")).toBe(Number(subject.getAttribute("aria-valuemax")));
    });
    expect(sizings).toEqual([{ subject: 120 }, { subject: 200 }]);

    const statusWidth = widthOf("Status");
    handle("Status").focus();
    await userEvent.keyboard("{End}");
    expect(sizings).toHaveLength(2);
    expect(widthOf("Status")).toBe(statusWidth);
    // The key stays with the handle. Left to the browser, End scrolls the page to its end.
    const end = new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true });
    handle("Status").dispatchEvent(end);
    expect(end.defaultPrevented).toBe(true);
  });
});
