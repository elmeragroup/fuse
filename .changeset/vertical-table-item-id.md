---
"@elmeragroup/fuse": minor
---

`VerticalTableItem` takes an optional `id`, which keys its row. Set it when `VerticalTable.Body`'s
`data` can be filtered, reordered or have rows inserted, so a stateful `value` stays with its own
item instead of the row that now sits at its old position.
