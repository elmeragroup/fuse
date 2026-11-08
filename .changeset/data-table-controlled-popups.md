---
"@elmeragroup/fuse": minor
---

`DataTable.ColumnToggle` and `table.ColumnToggle` take `open`, `defaultOpen` and `onOpenChange`
for their menu. `DataTable.Pagination` and `table.Pagination` take `pageSizeOpen`,
`defaultPageSizeOpen` and `onPageSizeOpenChange` for the Rows per page list. Each change callback
takes Base UI's signature, the next open state and the change details. Before, neither popup
could be controlled, so a host that had to close one remounted it.
