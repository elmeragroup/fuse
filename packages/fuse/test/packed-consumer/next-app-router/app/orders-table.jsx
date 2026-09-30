"use client";
import { createSortedRowModel, rowSortingFeature, sortFns, tableFeatures } from "@tanstack/react-table";

import { createFuseTableHook } from "@elmeragroup/fuse/data-table";

// The optional peer installed beside the tarball; the table uses the consumer's own copy.
const { useAppTable, createAppColumnHelper } = createFuseTableHook({
  features: tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns }),
});

const columns = createAppColumnHelper();
const COLUMNS = [
  columns.accessor("customer", {
    header: ({ header }) => <header.SortButton>Customer</header.SortButton>,
    cell: ({ cell }) => <cell.TextCell />,
  }),
];
const ORDERS = [{ customer: "Oslo" }, { customer: "Alta" }];

export function OrdersTable() {
  const table = useAppTable({ columns: COLUMNS, data: ORDERS });
  return (
    <table.AppTable>
      <table.Content aria-label="Orders" />
    </table.AppTable>
  );
}
