---
"@elmeragroup/fuse": patch
---

`DataTable.Content` and `DataTable.Header` accept a TanStack table under TypeScript 7.1. Before,
TypeScript 7.1 rejected the table from `useTable`. The first type parameter of both components
and of `DataTableContentProps` and `DataTableHeaderProps` is now the header group type, such as
TanStack's `HeaderGroup<TFeatures, TData>`, instead of the header type. JSX usage infers it, so
`<DataTable.Content table={table} />` needs no change.

The declarations of `Alert`, `Card`, `DescriptionList`, `Empty`, `Frame`, `Table`, `VerticalTable`
and `TimelineList` now type the `displayName` of each part as a string.
