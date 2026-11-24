---
"@elmeragroup/fuse": patch
---

`Chart.Table` and `Chart.ReferenceArea` now name a period of one slot once, in both the visible and
the spoken text. `Chart.Table` with one category row captions itself `Usage, Jan`, and
`Chart.ReferenceArea` with `x1` and `x2` on the same slot prints `Peak Jan` on a category axis and
`Peak W2` on a week axis. Before, they printed `Usage, Jan – Jan`, `Peak Jan – Jan` and
`Peak W2 – W2`. On an axis finer than a day, a one-slot band whose format prints a time of day still
runs from the slot's start to its end, so in en-US `label="Peak {value}"` prints `Peak 5 PM – 6 PM`.
