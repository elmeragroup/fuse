---
"@elmeragroup/fuse": minor
---

Add `xScale="linear"` to `Chart.Root` in the preview chart entry, `@elmeragroup/fuse/chart`, for a
number x column whose values are unevenly spaced, such as an EV's charging power by state of charge
or a capacity tariff's steps over kW. Each row sits at its x number over a nice x domain, and stays
one keyboard step, one tooltip readout, one table row and one spoken item, in ascending x order.
Rows may arrive in any order, a repeated x keeps its first row (`duplicate-x`), and an x that is
not a finite number is `invalid-x`.

Under `xScale="linear"`, `xFormat` takes a `ValueFormat` and prints the x numbers on the axis, in
the tooltip, the options, the description and the table. `xLabel` names the x measure in the options
and the table's header, and `xInclude` lists values the x domain must reach, as on `ScatterChart`.
The time-axis props, `orientation="horizontal"` and the range callbacks are typed out, and
`ChartPoint["x"]` reports the number.

- `XAxis` labels d3 nice numbers over the x domain, and `Grid` draws its x lines there.
- `Line` and `Area` draw their vertices at their x numbers. `curve="step-after"` holds each reading
  from its x to the next one's, the last to the plot's end, and `"step-before"` from the x before.
- `Bar` centers each bar on its x, every bar as wide as the closest two x values' distance less the
  band gap, clipped to the plot.
- The pointer picks the row whose x lies nearest, and `ReferenceLine` and `ReferenceArea` mark any x
  number at its true place.
- A data update tweens or crossfades. A shifted window never slides, since its rows lie unevenly.
- `Chart.Brush` throws `brush-needs-slot-axis` under a linear axis, and Root throws
  `horizontal-linear-axis` under `orientation="horizontal"`.

The new types `ChartXScaleProps`, `ChartSlotScaleProps` and `ChartLinearScaleProps` let a wrapper
type the x scale props.
