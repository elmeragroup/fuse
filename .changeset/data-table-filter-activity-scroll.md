---
"@elmeragroup/fuse": patch
---

`DataTableFilter` now keeps the chip strip's scroll position when a React `Activity` hides and
shows the filter while a chip's editor is open. Before, showing the filter again could scroll the
edited chip back into view.
