---
"@elmeragroup/fuse": patch
---

`--chart-quiet-opacity` on `ScatterChart.Root` sets the opacity of the quiet points and of every
quiet series' legend swatch. It is `0.45` by default, the opacity they drew at before.

`Chart.Root` and the bar routes no longer ship the scatter chart's words and data messages, which
saves about 1 kB of minified JavaScript on each. `ScatterChart.Root` no longer ships the cartesian
data messages, about 2 kB.
