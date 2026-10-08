---
"@elmeragroup/fuse": patch
---

A `CheckboxItem`, `RadioItem` or `SelectionItem.Shell` row whose `SelectionItem.SubSection`
children are all `mode="hidden"` now toggles from a click in its bottom 14px, like a row without
a SubSection. Before, that inset sat outside the click target, so the reveal-on-check pattern,
`<SubSection mode={checked ? "visible" : "hidden"}>`, had a dead strip along the bottom of an
unchecked row. Once a SubSection shows, it keeps its own clicks as before. The row's size does
not change.
