---
"@elmeragroup/fuse": patch
---

`Tabs.Content` hides a closing panel on the render that closes it. Base UI kept it shown until its exit transition ended, at least one painted frame, so the closing and the opening panel showed stacked and the content below jumped.
