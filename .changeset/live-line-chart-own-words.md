---
"@elmeragroup/fuse": patch
---

`Chart.Root` and the bar routes no longer ship the live line chart's words and its `value` data
message, which saves about 0.9 kB of minified JavaScript on the `Chart.Root` route.
`LiveLineChart` reads them from its own tables, and every string it prints and speaks is unchanged.
