import { useState } from "react";
import type { ReactElement } from "react";

/**
 * Browser project. Real TanStack v9 tables drive the plain and registered parts; every query is by
 * role and accessible name through the shared helpers.
 */
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFns,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnDef, PaginationState, Row } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import "../../../dist/styles.css";
import { withLocale } from "../../../test/locale-matrix";
import { renderThemed, roleNamed } from "../../../test/themed-browser-render";
import { Button } from "../button/button";
import { DropdownMenu } from "../dropdown-menu";
import { actionsColumn } from "./actions-column";
import { createFuseTableHook } from "./create-fuse-table-hook";
import { NumberCell } from "./data-table-registered";
import type { NumberCellProps, RegisteredRowProps } from "./data-table-registered";
import { DataTable } from "./index";
import { selectColumn } from "./select-column";

type Order = { readonly id: number; readonly customer: string; readonly amount: number };

function ordersOf(count: number): Order[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    customer: `Customer ${String(index + 1)}`,
    amount: (index + 1) * 1000.5,
  }));
}

// Module-level rows: TanStack resets the page index whenever `data` changes identity, so a fixture
// must not build its rows during render.
const ORDERS_3 = ordersOf(3);
const ORDERS_10 = ordersOf(10);
const ORDERS_25 = ordersOf(25);
const NO_ORDERS: Order[] = [];

const ORDERS: Order[] = [
  { id: 1, customer: "Bergen", amount: 1234.5 },
  { id: 2, customer: "Alta", amount: 20 },
  { id: 3, customer: "Oslo", amount: 300 },
];

function renderInEnglish(node: ReactElement) {
  return renderThemed(withLocale("en-US", node));
}

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  sortFns,
});

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features,
  getRowId: (order: Order) => String(order.id),
});

const appColumns = createAppColumnHelper<Order>();

const registeredColumns = appColumns.columns([
  appColumns.accessor("customer", {
    header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  appColumns.accessor("amount", {
    header: "Amount",
    enableSorting: false,
    cell: ({ cell }) => <cell.NumberCell maximumFractionDigits={1} />,
  }),
]);

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
  it("toggles aria-sort on the sortable <th> and leaves an unsortable one without it", async () => {
    renderInEnglish(<RegisteredTable />);

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

  it("renders header.SortButton and cell.NumberCell column definitions through table.Content", () => {
    renderInEnglish(<RegisteredTable />);

    expect(roleNamed("button", "Customer").closest("th")).toBe(columnHeader("Customer"));
    expect(roleNamed("cell", "1,234.5")).toBeInstanceOf(HTMLTableCellElement);
    expect(roleNamed("cell", "Bergen")).toBeInstanceOf(HTMLTableCellElement);
  });
});

const plainColumns = createColumnHelper<typeof features, Order>().columns([
  createColumnHelper<typeof features, Order>().accessor("customer", { header: "Customer" }),
]);

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

function CursorPagedTable({ pages }: { readonly pages: number }): ReactElement {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const table = useTable({
    features,
    columns: plainColumns,
    data: ORDERS_10,
    manualPagination: true,
    pageCount: -1,
    state: { pagination },
    onPaginationChange: setPagination,
  });
  return (
    <DataTable.Pagination
      table={table}
      total={{ kind: "unknown", hasMore: pagination.pageIndex < pages - 1 }}
    />
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

/** The disabled state of the first, previous, next and last buttons. */
function disabledMoves(): boolean[] {
  return Object.values(pageButtons()).map((control) => control.disabled);
}

describe("DataTable pagination", () => {
  it("navigates a known total and disables the moves its position rules out", async () => {
    renderInEnglish(<ClientPagedTable data={ORDERS_25} />);

    expect(page.getByText("Page 1 of 3", { exact: true }).element()).toBeTruthy();
    expect(disabledMoves()).toEqual([true, true, false, false]);

    await userEvent.click(pageButtons().next);
    await expect.element(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
    expect(roleNamed("cell", "Customer 11")).toBeInstanceOf(HTMLTableCellElement);

    await userEvent.click(pageButtons().last);
    await expect.element(page.getByText("Page 3 of 3", { exact: true })).toBeVisible();
    expect(disabledMoves()).toEqual([false, false, true, true]);

    await userEvent.click(pageButtons().first);
    await expect.element(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  });

  it("shows an empty known total as page 1 of 1 with every move disabled", () => {
    renderInEnglish(<ClientPagedTable data={NO_ORDERS} />);

    expect(page.getByText("Page 1 of 1", { exact: true }).element()).toBeTruthy();
    expect(disabledMoves()).toEqual([true, true, true, true]);
    expect(roleNamed("cell", "No results.")).toBeInstanceOf(HTMLTableCellElement);
  });

  it("follows hasMore for an unknown total, shows no page count and never enables Last", async () => {
    renderInEnglish(<CursorPagedTable pages={2} />);

    expect(page.getByText("Page 1", { exact: true }).element()).toBeTruthy();
    expect(disabledMoves()).toEqual([true, true, false, true]);

    await userEvent.click(pageButtons().next);
    await expect.element(page.getByText("Page 2", { exact: true })).toBeVisible();
    expect(disabledMoves()).toEqual([false, false, true, true]);
  });

  it("changes the page size through the labelled rows-per-page select", async () => {
    renderInEnglish(<ClientPagedTable data={ORDERS_25} />);

    await userEvent.click(roleNamed("combobox", "Rows per page"));
    await userEvent.click(roleNamed("option", "25"));
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

  it("follows the filtered page count on page index 0", async () => {
    renderInEnglish(<FilteredTable />);

    expect(page.getByText("Page 1 of 3", { exact: true }).element()).toBeTruthy();
    await userEvent.click(roleNamed("button", "Filter"));
    // "Customer 2" and "Customer 20" through "Customer 25": seven rows, one page.
    await expect.element(page.getByText("Page 1 of 1", { exact: true })).toBeVisible();
    expect(disabledMoves()).toEqual([true, true, true, true]);
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
      <table.Content<Order>>
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

  it("gives every trigger its own name", () => {
    renderInEnglish(<ActionsTable />);

    const triggers = ["Bergen", "Alta", "Oslo"].map((name) => roleNamed("button", `Actions for ${name}`));
    expect(new Set(triggers).size).toBe(3);
  });

  it("names the actions header without visible text and offers no sort or hide control", async () => {
    renderInEnglish(<ActionsTable />);

    const header = columnHeader("Actions");
    const name = header.firstElementChild;
    if (name === null) {
      throw new Error("expected the header's hidden name");
    }
    expect(name.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(name.getBoundingClientRect().height).toBeLessThanOrEqual(1);
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

describe("DataTable loading", () => {
  function LoadingTable(): ReactElement {
    const table = useTable({
      features,
      columns: plainColumns,
      data: [],
      initialState: { pagination: { pageIndex: 0, pageSize: 3 } },
    });
    return <DataTable.Content table={table} loading aria-label="Orders" />;
  }

  it("marks the table busy and renders page-size many skeleton rows", () => {
    renderInEnglish(<LoadingTable />);

    const table = roleNamed("table", "Orders");
    expect(table.getAttribute("aria-busy")).toBe("true");
    // One header row plus three skeleton rows, and no empty-state text.
    expect(page.getByRole("row").elements()).toHaveLength(4);
    expect(page.getByText("No results.", { exact: true }).elements()).toHaveLength(0);
  });
});
