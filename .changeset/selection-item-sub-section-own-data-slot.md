---
"@elmeragroup/fuse": patch
---

A visible SubSection that takes its own `data-slot` or `data-mode` keeps the selection row's click
target as it was. With `isSubSectionSelectable` off, a click in the row's bottom padding, or in its
side padding beside the SubSection, no longer toggles the row. This holds in the default Shell
layout for a `SelectionItem.SubSection` passed as a direct child of the row and for an
`Item.Footer` passed through the Shell's `subSections` prop. With `isSubSectionSelectable` on, a
click in the bottom padding reaches the row's SubSection click handling, so an `onClick` that
calls `preventBaseUIHandler()` cancels the toggle.
