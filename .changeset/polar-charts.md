---
"@elmeragroup/fuse": minor
---

`PieChart`, `RadialChart` and `RadarChart` in the preview chart entry, `@elmeragroup/fuse/chart`,
now draw, and the entry adds `ClockChart`. Each starts at `Root`, reads its series from `config`,
and shares `Tooltip`, `Legend`, `LegendToggleGroup`, `Table`, `Empty`, `Skeleton`, `Headline`,
`Takeaway`, `Glow` and `Background` with `Chart`.

- `PieChart` draws slices or a donut from one row per category, folds the smallest past
  `maxSlices` into Other, and keeps at least one device pixel of rim for every reading above 0.
  `Labels` sit inside a slice where they fit and outside with a leader otherwise. `Center` prints
  the total, or the active slice's value and share, `Track` fills the sweep of a gauge, and the
  active slice pops along its bisector.
- `RadialChart` draws one ring per category against `max`, in solid, dotted or segmented looks, with
  a `Track` under each ring and the same `Center` parts.
- `RadarChart` draws series as polygons over spokes, with `Grid`, `AngleAxis`, `RadiusAxis`,
  `Area`, `Line`, `Dots` and `ActiveDot`, and a radius domain that may reach below 0.
- `ClockChart` lays a day, a week or a year round a dial from Root's `cycle` and `interval`, in the
  data's time zone, so a 23- or 25-hour day keeps equal hours. `Line`, `Area`, `Column` and `Dots`
  draw its series, stacked through config `stack`, a series coarser than Root's interval draws one
  wedge per own slot, and a threshold or scale colour paints each wedge by its own value. `Grid`,
  `AngleAxis`, `RadiusAxis`, `ReferenceLine`, `ReferenceArea`, `Scrubber`, `Now`, `Center`,
  `ActiveValue`, `Marker`, `ValueLabel` and `TooltipTotal` complete it.

The dial labels thin by one stride for the whole dial, a ring value shows only where it clears the
marks and the angle labels, and Now's label shows past the rim only where it clears the cycle's
labels. Each plot is one tab stop whose option walks the slices, rings, spokes or slots: arrows
step, Home and End jump, and on a clock PageUp and PageDown move a label unit. A drag that starts on
a dial scrubs round it and never scrolls the page, which scrolls from beside the dial.

The entrance plays once in view over `--chart-intro` with `--chart-stagger` between items, and a
data update tweens over `--chart-update`, labels, leaders and active dots with their marks.
Reduced motion and print draw every mark at rest, forced colours keep each series' colour, and the
server sends every mark, so a chart reads with JavaScript off.
