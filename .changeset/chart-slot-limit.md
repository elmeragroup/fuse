---
"@elmeragroup/fuse": patch
---

A chart's time axis lists at most 1,000,000 slots. An `interval` too fine for the data's range or
the `period`, such as seconds over a year, now throws a `ChartCompositionError` with the rule
`slot-limit`, naming the interval, the range, the slot count and the limit. A `period` with an
invalid date throws the same rule, naming the period. Before, the axis built every slot and the
page ran out of memory. A year of minutes, 525,600 slots, still renders.

Unlike the other data-driven checks, `slot-limit` throws in production too, also when the rows'
range rather than `period` sets the span: no fallback can draw such an axis.
