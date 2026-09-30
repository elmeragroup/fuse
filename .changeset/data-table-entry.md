---
"@elmeragroup/fuse": minor
---

New `@elmeragroup/fuse/data-table` entry for TanStack Table v9. Install `@tanstack/react-table` 9.2 or
later beside Fuse; it is an optional peer, and the entry is not in the root barrel.

- `DataTable.*` parts take a plain `useTable` table: `Content`, `Header`, `Body`, `Row`, `Pagination`,
  `SortButton`, `ColumnToggle`, `SelectAll`, `SelectRow`, `RowActions`, and the `Text`, `Number`, `Date`,
  `DateTime` and `Currency` cells.
- `createFuseTableHook` wraps `createTableHook` and registers the same parts as `table.Content`,
  `table.Row`, `table.Pagination`, `table.ColumnToggle`, `header.SortButton` and the default cells.
  It passes the app's `features` and options through unchanged. An app component registered under a
  Fuse key replaces Fuse's, props included.
- `selectColumn(columnHelper, { getRowLabel })` builds a page-scoped selection column.
- `actionsColumn(columnHelper, { getRowName, items })` builds a row-actions column around
  `DataTable.RowActions`. Each trigger is named from its row ("Actions for …"), the header is named
  "Actions" without visible text, and the column cannot sort or hide. The app supplies the menu items.
- `Pagination` takes `total` as `{ kind: "known", pageCount }` or `{ kind: "unknown", hasMore }`.

`@elmeragroup/fuse/icons` adds `CaretDoubleLeft` and `CaretDoubleRight`.
