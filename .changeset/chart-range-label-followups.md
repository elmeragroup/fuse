---
"@elmeragroup/fuse": patch
---

Under `xScale="linear"`, a `Chart.Table` caption over more than one row now prints its period as a
linear `Chart.ReferenceArea` band does. A unit that both ends write after the number prints once,
and readers hear each end's spoken form. With `xFormat={{ style: "unit", unit: "kilometer" }}` in
en-US, the caption shows `Usage, 5–10 km` and reads `Usage, 5 kilometers to 10 kilometers`.
Before, it showed `Usage, 5 km–10 km` and read `Usage, 5 km to 10 km`. Unlike a band, a caption
whose two ends print alike prints one label, as before, and readers now hear its spoken form.

A `ClockChart.ReferenceArea` sector with no `format`, whose `x1` and `x2` fall on the same slot of
a dial with slots of a day or longer, now prints that slot's label once, as `Chart.ReferenceArea`
does. On a year dial of months, `label="Peak {value}"` prints `Peak January 2026`, where it printed
`Peak January 2026 – January 2026`.
