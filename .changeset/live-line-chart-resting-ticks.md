---
"@elmeragroup/fuse": patch
---

`LiveLineChart.YAxis` and `LiveLineChart.Grid` leave out a value tick and its grid line whose resting
place is inside the 16px fade at the plot's top or bottom. A tick beyond the resting domain, which a
contracting domain carries out, still fades at the edge it leaves by. A paused chart's ticks rest where
they show, at the step of the domain it holds. `LiveLineChart.XAxis` leaves out a time tick inside the
40px side fades while the window holds still: while the chart is `paused`, while the clock waits out a
lead from readings stamped ahead of the wall clock, and under reduced motion, where the window redraws
on a new reading and when `value` or `windowMs` changes. When that would leave the axis empty, it keeps
the tick nearest the middle if its label fits at the axis's font size in any common sans. A tick at rest is opaque once its enter fade finishes,
and holds `muted-foreground`'s contrast. Before, a tick could rest partly faded, under 4.5:1. Ticks
still fade at the edges while the window scrolls or the domain glides, and value ticks and grid lines
still fade in and out as they enter or leave.
