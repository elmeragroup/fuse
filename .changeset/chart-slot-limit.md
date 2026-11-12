---
"@elmeragroup/fuse": patch
---

A chart's time axis lists at most 1,000,000 slots. An `interval` too fine for the data's range or
the `period`, such as seconds over a year, now throws a `ChartCompositionError` with the rule
`slot-limit`, naming the interval, the range, the slot count and the limit. Before, the axis built
every slot and the page ran out of memory. A year of minutes, 525,600 slots, still renders.
