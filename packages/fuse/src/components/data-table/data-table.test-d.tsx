import type { ReactElement } from "react";

/**
 * Public type guarantees of `@elmeragroup/fuse/data-table`. Each positive case has a negative
 * control: a slice-typed part must reject a table built without the feature it reads, and a
 * feature-conditional registered part must be absent from the types when its feature is.
 */
import {
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { Row } from "@tanstack/react-table";
import { expectTypeOf, test } from "vitest";

import { actionsColumn, createFuseTableHook, DataTable, selectColumn } from "@elmeragroup/fuse/data-table";
import type { RegisteredRowProps } from "@elmeragroup/fuse/data-table";

type Order = {
  readonly id: number;
  readonly customer: string;
  readonly amount: number;
  readonly placed: Date;
};

const orders: Order[] = [];

const everyFeature = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

const coreOnly = tableFeatures({});

function SelectionToolbar(): ReactElement {
  return <div />;
}

function OrderIdCell(_props: { readonly prefix: string }): ReactElement {
  return <span />;
}

function AppDateCell(_props: { readonly relative: boolean }): ReactElement {
  return <span />;
}

const full = createFuseTableHook({
  features: everyFeature,
  tableComponents: { SelectionToolbar },
  cellComponents: { OrderIdCell, DateCell: AppDateCell },
});

const bare = createFuseTableHook({ features: coreOnly });

test("a slice-typed plain part accepts an app table with extra features and rejects one without the feature", () => {
  function WithEveryFeature(): ReactElement {
    const table = useTable({ features: everyFeature, columns: [], data: orders });
    return (
      <>
        <DataTable.Pagination table={table} />
        <DataTable.ColumnToggle table={table} />
        <DataTable.SelectAll table={table} />
        <DataTable.Content table={table} />
      </>
    );
  }

  function WithoutFeatures(): ReactElement {
    const table = useTable({ features: coreOnly, columns: [], data: orders });
    return (
      <>
        {/* @ts-expect-error -- Pagination reads rowPaginationFeature members the core table lacks */}
        <DataTable.Pagination table={table} />
        {/* @ts-expect-error -- ColumnToggle reads columnVisibilityFeature members on each column */}
        <DataTable.ColumnToggle table={table} />
        {/* @ts-expect-error -- SelectAll reads rowSelectionFeature members the core table lacks */}
        <DataTable.SelectAll table={table} />
        {/* Content reads only core members, so the core table is enough. */}
        <DataTable.Content table={table} />
      </>
    );
  }

  expectTypeOf(WithEveryFeature).toBeFunction();
  expectTypeOf(WithoutFeatures).toBeFunction();
});

test("a plain part's column and row props follow the same feature slices", () => {
  function Parts(): ReactElement {
    const sorted = useTable({ features: everyFeature, columns: [], data: orders });
    const plain = useTable({ features: coreOnly, columns: [], data: orders });
    const [sortedColumn] = sorted.getAllLeafColumns();
    const [plainColumn] = plain.getAllLeafColumns();
    const [sortedRow] = sorted.getRowModel().rows;
    const [plainRow] = plain.getRowModel().rows;
    if (sortedColumn === undefined || plainColumn === undefined) {
      return <span />;
    }
    if (sortedRow === undefined || plainRow === undefined) {
      return <span />;
    }
    return (
      <>
        <DataTable.SortButton column={sortedColumn}>Amount</DataTable.SortButton>
        {/* @ts-expect-error -- SortButton reads rowSortingFeature members on the column */}
        <DataTable.SortButton column={plainColumn}>Amount</DataTable.SortButton>
        <DataTable.SelectRow row={sortedRow} label="Select order 1" />
        {/* @ts-expect-error -- SelectRow reads rowSelectionFeature members on the row */}
        <DataTable.SelectRow row={plainRow} label="Select order 1" />
        <DataTable.Row table={plain} row={plainRow} />
      </>
    );
  }

  expectTypeOf(Parts).toBeFunction();
});

test("feature-conditional registered table parts exist only with their feature", () => {
  type FullTable = ReturnType<typeof full.useAppTable<Order>>;
  type BareTable = ReturnType<typeof bare.useAppTable<Order>>;

  expectTypeOf<FullTable>().toHaveProperty("Content");
  expectTypeOf<FullTable>().toHaveProperty("Row");
  expectTypeOf<FullTable>().toHaveProperty("Pagination");
  expectTypeOf<FullTable>().toHaveProperty("ColumnToggle");

  expectTypeOf<BareTable>().toHaveProperty("Content");
  expectTypeOf<BareTable>().toHaveProperty("Row");
  expectTypeOf<BareTable>().not.toHaveProperty("Pagination");
  expectTypeOf<BareTable>().not.toHaveProperty("ColumnToggle");

  function BareToggle(): ReactElement {
    const table = bare.useAppTable({ columns: [], data: orders });
    return (
      <table.AppTable>
        {/* @ts-expect-error -- ColumnToggle requires columnVisibilityFeature in `features` */}
        <table.ColumnToggle />
        {/* @ts-expect-error -- Pagination requires rowPaginationFeature in `features` */}
        <table.Pagination />
        <table.Content />
      </table.AppTable>
    );
  }

  expectTypeOf(BareToggle).toBeFunction();
});

test("the sort button is a registered header part only with rowSortingFeature", () => {
  const fullColumns = full.createAppColumnHelper<Order>();
  const bareColumns = bare.createAppColumnHelper<Order>();

  fullColumns.accessor("amount", {
    header: ({ header }) => <header.SortButton>Amount</header.SortButton>,
    cell: ({ cell }) => <cell.NumberCell maximumFractionDigits={0} />,
  });
  bareColumns.accessor("amount", {
    // @ts-expect-error -- SortButton requires rowSortingFeature in `features`
    header: ({ header }) => <header.SortButton>Amount</header.SortButton>,
    cell: ({ cell }) => <cell.NumberCell />,
  });
});

test("selectColumn requires rowSelectionFeature and a row label typed from the row data", () => {
  const fullColumns = full.createAppColumnHelper<Order>();
  const bareColumns = bare.createAppColumnHelper<Order>();

  selectColumn(fullColumns, { getRowLabel: (order) => `Select order ${String(order.id)}` });
  // @ts-expect-error -- `getRowLabel` is required so every checkbox has its own name
  selectColumn(fullColumns, {});
  // @ts-expect-error -- `order` is an Order, which has no `sku`
  selectColumn(fullColumns, { getRowLabel: (order) => order.sku }); // oxlint-disable-line typescript/no-unsafe-return -- the deliberate type error under test is error-typed
  // @ts-expect-error -- the helper's table lacks rowSelectionFeature
  selectColumn(bareColumns, { getRowLabel: (order) => `Select order ${String(order.id)}` });
});

test("actionsColumn requires a row name and items, both typed from the row data", () => {
  const bareColumns = bare.createAppColumnHelper<Order>();

  actionsColumn(bareColumns, {
    getRowName: (order) => order.customer,
    items: (order) => <span>{order.amount}</span>,
  });
  // @ts-expect-error -- `getRowName` is required so every trigger has its own name
  actionsColumn(bareColumns, { items: () => null });
  // @ts-expect-error -- `items` is required: Fuse ships no default actions
  actionsColumn(bareColumns, { getRowName: (order) => order.customer });
  // @ts-expect-error -- `order` is an Order, which has no `name`
  actionsColumn(bareColumns, { getRowName: (order) => order.name, items: () => null }); // oxlint-disable-line typescript/no-unsafe-return -- the deliberate type error under test is error-typed
  // @ts-expect-error -- `order` is an Order, which has no `sku`
  actionsColumn(bareColumns, { getRowName: (order) => order.customer, items: (order) => order.sku }); // oxlint-disable-line typescript/no-unsafe-return -- the deliberate type error under test is error-typed
});

test("an app override replaces the Fuse props rather than overloading them", () => {
  const columns = full.createAppColumnHelper<Order>();

  columns.accessor("placed", {
    cell: ({ cell }) => <cell.DateCell relative />,
  });
  columns.accessor("placed", {
    // @ts-expect-error -- the app replaced DateCell, so Fuse's dateStyle prop is gone
    cell: ({ cell }) => <cell.DateCell dateStyle="short" />,
  });
  columns.accessor("placed", {
    cell: ({ cell }) => <cell.DateTimeCell dateStyle="short" timeStyle="short" />,
  });
});

test("an app Row must accept the props table.Content renders its default rows with", () => {
  type OrderRowProps = RegisteredRowProps<Row<typeof coreOnly, Order>>;

  function OrderRow(_props: OrderRowProps): ReactElement {
    return <tr />;
  }

  function TonedRow(_props: OrderRowProps & { readonly tone: "muted" }): ReactElement {
    return <tr />;
  }

  createFuseTableHook({ features: coreOnly, tableComponents: { Row: OrderRow } });
  createFuseTableHook({
    features: coreOnly,
    // @ts-expect-error -- table.Content renders the registered Row without `tone`
    tableComponents: { Row: TonedRow },
  });
});

test("the app's own components and TanStack's feature APIs stay typed on the returned table", () => {
  type FullTable = ReturnType<typeof full.useAppTable<Order>>;

  expectTypeOf<FullTable>().toHaveProperty("SelectionToolbar");
  expectTypeOf<FullTable["getCanNextPage"]>().toEqualTypeOf<() => boolean>();
  expectTypeOf<FullTable["toggleAllPageRowsSelected"]>().toBeFunction();
  expectTypeOf<FullTable["getRowModel"]>().returns.toHaveProperty("rows");

  const columns = full.createAppColumnHelper<Order>();
  columns.accessor("id", { cell: ({ cell }) => <cell.OrderIdCell prefix="#" /> });
  // @ts-expect-error -- OrderIdCell requires its `prefix`
  columns.accessor("id", { cell: ({ cell }) => <cell.OrderIdCell /> });
});

test("a plain cell's value is type-checked", () => {
  const _number = <DataTable.Number value={4711} />;
  // @ts-expect-error -- Number formats numbers only
  const _numberFromString = <DataTable.Number value="x" />;
  const _date = <DataTable.Date value={new Date(0)} />;
  // @ts-expect-error -- Date formats Date values only
  const _dateFromNumber = <DataTable.Date value={0} />;
  const _currency = <DataTable.Currency value={10} currency="NOK" />;
  // @ts-expect-error -- Currency has no sensible default code
  const _currencyWithoutCode = <DataTable.Currency value={10} />;
  const _text = <DataTable.Text value="Ada" />;
  // @ts-expect-error -- Text renders strings only
  const _textFromNumber = <DataTable.Text value={1} />;
});

test("a known or unknown total is the only pagination total shape", () => {
  function Totals(): ReactElement {
    const table = useTable({ features: everyFeature, columns: [], data: orders });
    return (
      <>
        <DataTable.Pagination table={table} total={{ kind: "known", pageCount: 4 }} />
        <DataTable.Pagination table={table} total={{ kind: "unknown", hasMore: true }} />
        {/* @ts-expect-error -- an unknown total carries hasMore, not a page count */}
        <DataTable.Pagination table={table} total={{ kind: "unknown", pageCount: 4 }} />
      </>
    );
  }

  expectTypeOf(Totals).toBeFunction();
});
