---
"@elmeragroup/fuse": patch
---

A `Table.Root` table wider than its container is now reachable with Tab and scrolls sideways with
the browser's scrolling keys. The focused container is a group with an inset focus outline. Its
name comes from the table's `aria-labelledby` and `aria-label`, else from its `Table.Caption`, so
name a table that may scroll. A control inside the table keeps the stop. A table that fits its
container, a container a consumer style sets to `overflow: visible`, and a table that sets its own
`tabIndex` add no stop. `DataTable` and `VerticalTable` tables follow the same rule.
