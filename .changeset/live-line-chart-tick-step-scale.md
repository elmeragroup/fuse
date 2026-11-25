---
"@elmeragroup/fuse": patch
---

`LiveLineChart.XAxis` now accounts for the axis's font size when it picks its tick spacing, so a
larger root font size or text zoom widens the step. Before, the step assumed 12px labels: at a 32px
root, a 600px chart stepped 5s and left about 15px between labels.

A still axis also leaves out a tick whose label would cross the plot's edge at that size. When no
tick of its step fits, it keeps the tick nearest the middle whose label fits, of a finer step if
need be, labeled in that step's format.
