---
"@elmeragroup/fuse": patch
---

`Table.Root`: when a table scrolls sideways and its viewport takes keyboard focus, the viewport's
focus outline shows on all four edges in Chromium, over a framed body, sticky cells and a table with
its own `z-index`. A table that sets its own `tabIndex` keeps that value on the table, and its
viewport then leaves the tab order and draws no outline. Before, inside `Frame.Root`, the body
covered the outline. The table now sits in a scrolling `table-viewport` inside `table-container`,
and the viewport carries the tab stop, its role and its name. A selector written as
`[data-slot="table-container"] > table` needs the viewport between the two. The container no longer
scrolls, so a style that lets the table spill out sets `overflow: visible` on
`[data-slot="table-viewport"]`, which also drops the stop. In a height-capped Frame the viewport
scrolls both axes, and a sticky `Table.Header` stays at its top. In an inline-block parent, the
table's box now aligns to the first baseline of its content, not to its bottom edge.
