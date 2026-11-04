---
"@elmeragroup/fuse": minor
---

Add `ScatterChart` to the preview chart entry, `@elmeragroup/fuse/chart`. It plots a number against
a number from long rows: `xKey` and `yKey` name a row's two number columns, and `seriesKey` names
the column that says which config series the point belongs to. `Points` draws a series as dots in
named sizes and a `quiet` look, and `Line` joins a series' points in x order, so the same chart
draws curves over an unevenly spaced numeric x. `Grid`, `XAxis`, `YAxis`, `ReferenceLine`,
`ActiveDot`, `Tooltip`, `Legend`, `Table`, `Empty` and `Skeleton` complete it. The plot is one tab
stop whose option walks every point by x, and the pointer finds the nearest point. Each series draws
as one SVG path, so 100,000 points draw and update in about a tenth of a second.
