---
"@elmeragroup/fuse": patch
---

The polar charts' tooltip now stays clear of a `Chart.Legend` or `Chart.Headline` that takes its
own `data-slot`. Before, the popup's placement missed such a Legend or Headline and could rest over
it.

The polar charts' tooltip now opens as wide as its longest label when `Chart.TooltipLabel` takes its
own `data-slot`. Before, it opened at the current label's width and widened as a key step reached a
longer label. A `Chart.TooltipLabel` whose `format` changes its text, whose `children` or `render`
element replace it, or whose `render` function prints other text, now sizes the popup by the text it
prints. Before, the popup took the width of Root's labels. Text from `children` or a `render`
element counts even when it matches a slice's name. A `format` the chart does not use, such as
`format="date"` on a pie, keeps the width of Root's labels. The lane's width limits still apply, so
a 300 px label wraps in a side lane capped at 256 px.

`Chart.Reveal` now leaves a consumer's own SVG child alone when it carries the `data-slot` of a
line, area or dots layer. Before, Reveal wrote the active slot's place, `--chart-active-x`, on that
child too, and while a slot was active its mask replaced the child's own mask. It now writes and
masks only the Line, Area and Dots it wraps.

The ClockChart tooltip now stays clear of a `ClockChart.ReferenceLine` or `ClockChart.ReferenceArea`
label past the rim. Before, a popup in a side lane could cover the label.
