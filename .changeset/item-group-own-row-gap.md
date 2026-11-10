---
"@elmeragroup/fuse": patch
---

`Item.Group` now takes its smaller gap only from its own `sm` or `xs` rows: direct child
`Item.Root`s, with or without a `render` element. An `Alert` or a small `Item.Root` nested inside a
row, or a row wrapped in another element, no longer changes the group's gap. A `gap-*` class in the
group's `className` now replaces the gap even when its rows are `sm` or `xs`. A vertical
`RadioItemGroup` or `CheckboxItemGroup` with an `Alert` in a row's `SubSection`, even a hidden one,
keeps its rows joined, and a horizontal one keeps its usual gap.
