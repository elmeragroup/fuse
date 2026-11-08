---
"@elmeragroup/fuse": patch
---

`Sidebar.Separator` now ends 8px before the content's end edge, as it starts 8px after the start
edge. Before, it took the full content width past its start margin, so it ran 8px past the end
and the content clipped it.
