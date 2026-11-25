---
"@elmeragroup/fuse": patch
---

When new data drops a `PieChart` category's row while the pie has an Other slice, the category's
slice collapses onto the start of the next slice that stays, or onto the sweep's end when no slice
after it stays. Before, it always collapsed onto Other's start.
