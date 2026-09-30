/**
 * Server-visible namespace for `DataTable`, the plain parts.
 * The implementations stay client modules; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { DataTableBody, DataTableContent, DataTableHeader, DataTableRow } from "./data-table";
import {
  DataTableCurrency,
  DataTableDate,
  DataTableDateTime,
  DataTableNumber,
  DataTableText,
} from "./data-table-cells";
import { DataTableColumnToggle } from "./data-table-column-toggle";
import { DataTablePagination } from "./data-table-pagination";
import { DataTableSelectAll, DataTableSelectRow } from "./data-table-selection";
import { DataTableSortButton } from "./data-table-sort-button";

export const DataTable = {
  Content: DataTableContent,
  Header: DataTableHeader,
  Body: DataTableBody,
  Row: DataTableRow,
  Pagination: DataTablePagination,
  SortButton: DataTableSortButton,
  ColumnToggle: DataTableColumnToggle,
  SelectAll: DataTableSelectAll,
  SelectRow: DataTableSelectRow,
  Text: DataTableText,
  Number: DataTableNumber,
  Date: DataTableDate,
  DateTime: DataTableDateTime,
  Currency: DataTableCurrency,
};
