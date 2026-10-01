"use client";

import {
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
} from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Invoice = {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
  readonly due: Date;
};

// The app owns the features and defaults. Fuse registers its parts and cells on top.
const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    columnVisibilityFeature,
    rowPaginationFeature,
    rowSortingFeature,
    paginatedRowModel: createPaginatedRowModel(),
    sortedRowModel: createSortedRowModel(),
    sortFns,
  }),
  enableSortingRemoval: false,
  getRowId: (invoice: Invoice) => invoice.id,
});

const columns = createAppColumnHelper<Invoice>();

const COLUMNS = columns.columns([
  columns.accessor("id", { header: "Invoice", enableHiding: false, cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("customer", {
    header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
  columns.accessor("amount", {
    header: ({ header }) => <header.SortButton>Amount</header.SortButton>,
    cell: ({ cell }) => <cell.CurrencyCell currency="NOK" />,
  }),
  columns.accessor("due", {
    header: ({ header }) => <header.SortButton>Due</header.SortButton>,
    cell: ({ cell }) => <cell.DateCell />,
  }),
]);

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris", "Nordlys Kafé", "Solsikke Barnehage"];

// Module-level rows: TanStack resets the page index whenever `data` changes identity.
const INVOICES: Invoice[] = Array.from({ length: 23 }, (_, index) => ({
  id: `INV-${String(1001 + index)}`,
  customer: CUSTOMERS[index % CUSTOMERS.length] ?? "Aurora Bakeri",
  amount: 450 + ((index * 1375) % 9000),
  due: new Date(Date.UTC(2026, 9, 1 + index)),
}));

const COLUMN_LABELS = new Map([
  ["customer", "Customer"],
  ["amount", "Amount"],
  ["due", "Due"],
]);

export function DataTableClientPaged() {
  const table = useFuseTable({
    columns: COLUMNS,
    data: INVOICES,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  });

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <table.ColumnToggle getLabel={(column) => COLUMN_LABELS.get(column.id) ?? column.id} />
        </div>
        <table.Content aria-label="Invoices" />
        <table.Pagination pageSizes={[5, 10, 25]} />
      </div>
    </table.AppTable>
  );
}
