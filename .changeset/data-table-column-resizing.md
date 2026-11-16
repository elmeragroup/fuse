---
"@elmeragroup/fuse": minor
---

`DataTable` columns can be resized. Register `columnSizingFeature` and `columnResizingFeature`, and
render `header.ResizeHandle`, or `DataTable.ResizeHandle` with a `header`, in a column's header with
the column's name as `columnName`. A table with `columnSizingFeature` lays out from a `<colgroup>`
of the columns' `size` in px under `table-layout: fixed`, is as wide as its columns together, and
scrolls sideways in its container. A cell or header cell cuts content wider than its column short
with an ellipsis, and `DataTable.SortButton` now truncates its label to fit its header cell.

The handle is a focusable vertical `separator` at the header cell's end edge, with a 24px hit area
at both densities. Arrow keys change the width by 10px, Home and End jump to the column's `minSize`
and `maxSize`, and a double-click resets the width. Key chords with Alt, Control or Meta stay with
the browser. The handle does not narrow a column below 32px, which its target needs. A pointer
press focuses the handle, and a drag previews and announces the width without rendering any row
and commits `columnSizing` once, on release, so `onColumnSizingChange` fires once per drag and once
per key press. Clicks on the handle do not reach the header around it, and the handle stays
beneath a host's sticky bar. Turn a column's handle off with `enableResizing: false`.
`selectColumn` is now 48px and `actionsColumn` 76px wide in a sized table, and neither can be
resized. A table without `columnSizingFeature` renders as before.
