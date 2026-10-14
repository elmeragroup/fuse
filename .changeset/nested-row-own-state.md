---
"@elmeragroup/fuse": patch
---

A `CheckboxItem`, `RadioItem` or `SelectionItem.Shell` row no longer paints as checked when a row
nested in its `SubSection` is checked. Before, an unchecked row took the checked fill, border and
dividers from any checked row inside it, even inside a `mode="hidden"` SubSection. A row now reads
only its own control.

A title-only `Item` nested in a described `Item`'s `Item.Footer`, or in the `SubSection` of a
`CheckboxItem` or `RadioItem` with a description, keeps its own centring. Before, the outer row's
description top-aligned the nested row's media and content, so its title sat about 10px above its
media's centre. Each row now aligns by its own `Item.Description`.
