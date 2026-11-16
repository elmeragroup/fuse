---
"@elmeragroup/fuse": patch
---

A `Chart` data update that slides the window by whole slots, such as an append that drops the first
row, now runs for the time since the previous `data` when that is shorter than 480 ms, in the
preview chart entry, `@elmeragroup/fuse/chart`. A feed faster than 480 ms used to cut each slide
short with the next one, so the line stuttered. Now each slide ends as the next reading arrives. Every
mark the update moves, such as a line, an area, a bar and the dots and markers on them, runs for the
same time. Any other
data update still takes 480 ms, and reduced motion still draws the new data at once.
