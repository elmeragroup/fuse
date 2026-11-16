"use client";

import { createPaginatedRowModel, rowPaginationFeature, tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

type Invoice = {
  readonly id: string;
  readonly customer: string;
  readonly amount: number;
  readonly due: Date;
};

// The app owns the features and defaults. Fuse registers its parts and cells on top.
const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({ rowPaginationFeature, paginatedRowModel: createPaginatedRowModel() }),
  getRowId: (invoice: Invoice) => invoice.id,
});

const columns = createAppColumnHelper<Invoice>();

const COLUMNS = columns.columns([
  columns.accessor("id", { header: "Invoice", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("amount", { header: "Amount", cell: ({ cell }) => <cell.CurrencyCell currency="NOK" /> }),
  columns.accessor("due", { header: "Due", cell: ({ cell }) => <cell.DateCell timeZone="Europe/Oslo" /> }),
]);

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris", "Nordlys Kafé", "Solsikke Barnehage"];

// Module-level rows: TanStack resets the page index whenever `data` changes identity.
const INVOICES: Invoice[] = Array.from({ length: 23 }, (_, index) => ({
  id: `INV-${String(1001 + index)}`,
  customer: CUSTOMERS[index % CUSTOMERS.length] ?? "Aurora Bakeri",
  amount: 450 + ((index * 1375) % 9000),
  due: new Date(Date.UTC(2026, 9, 1 + index)),
}));

export function DataTablePagination() {
  const table = useFuseTable({
    columns: COLUMNS,
    data: INVOICES,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  });

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        <table.Content aria-label="Invoices" />
        <table.Pagination pageSizes={[5, 10, 25]} />
      </div>
    </table.AppTable>
  );
}
