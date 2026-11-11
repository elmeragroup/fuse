"use client";

import {
  createPaginatedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  tableFeatures,
} from "@tanstack/react-table";

import { ActionBar } from "@elmeragroup/fuse/action-bar";
import { createFuseTableHook, selectColumn } from "@elmeragroup/fuse/data-table";
import { PaperPlaneTilt } from "@elmeragroup/fuse/icons";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

type Invoice = { readonly id: string; readonly customer: string };

const { useAppTable: useFuseTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({
    rowPaginationFeature,
    rowSelectionFeature,
    paginatedRowModel: createPaginatedRowModel(),
  }),
  getRowId: (invoice: Invoice) => invoice.id,
});

const columns = createAppColumnHelper<Invoice>();

const COLUMNS = columns.columns([
  selectColumn(columns, { getRowLabel: (invoice) => `Select ${invoice.id}` }),
  columns.accessor("id", { header: "Invoice", cell: ({ cell }) => <cell.TextCell /> }),
  columns.accessor("customer", { header: "Customer", cell: ({ cell }) => <cell.TextCell /> }),
]);

const CUSTOMERS = ["Aurora Bakeri", "Fjellstue AS", "Havbris", "Nordlys Kafé", "Solsikke Barnehage"];

// Module-level rows: TanStack resets the page index whenever `data` changes identity.
const INVOICES: Invoice[] = Array.from({ length: 23 }, (_, index) => ({
  id: `INV-${String(1001 + index)}`,
  customer: CUSTOMERS[index % CUSTOMERS.length] ?? "Aurora Bakeri",
}));

export function ActionBarPagination() {
  const table = useFuseTable({
    columns: COLUMNS,
    data: INVOICES,
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  });
  const count = table.getSelectedRowModel().rows.length;

  return (
    <table.AppTable>
      <div className="flex flex-col gap-4">
        {/* The bar's positioned ancestor ends above the pagination, however tall it wraps. */}
        <div className="relative">
          <table.Content aria-label="Invoices" />
          <ActionBar.Root count={count} aria-label="Invoice actions">
            <ActionBar.Count />
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <ActionBar.Clear
                    onClick={() => {
                      table.resetRowSelection();
                    }}
                  />
                }
              />
              <Tooltip.Content>Clear selection</Tooltip.Content>
            </Tooltip.Root>
            <ActionBar.Separator />
            <ActionBar.Button>
              <PaperPlaneTilt data-icon="inline-start" />
              <ActionBar.ButtonLabel>Send reminders</ActionBar.ButtonLabel>
            </ActionBar.Button>
          </ActionBar.Root>
        </div>
        <table.Pagination pageSizes={[5, 10, 25]} />
      </div>
    </table.AppTable>
  );
}
