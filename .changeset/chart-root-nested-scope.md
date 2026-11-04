---
"@elmeragroup/fuse": patch
---

A `Chart.Root` (`@elmeragroup/fuse/chart`) nested inside another chart's part now behaves as it
does on its own. Before, it took on the outer chart's state:

- Inside `PieChart.Root`, `RadialChart.Root` or `RadarChart.Root`, it rendered no legend,
  tooltip, table or empty state.
- Inside a `Chart.Tooltip`, its `Chart.SeriesLabel`, `Chart.Swatch` and other readout parts
  followed its own pointer as if they sat in its tooltip.
- Inside a `Chart.Headline`, its `Chart.ActiveValue` printed exposed headline text instead of
  its plot label.
- Inside a `Chart.Crosshair`'s children, it showed a `Chart.SlotLabel` placed outside its own
  Crosshair.
- Inside a `Chart.Marker` or `Chart.ActiveValueLine`, a `Chart.ValueLabel` placed outside its own
  Marker or ActiveValueLine printed a value, taking its series key and slot from the outer part.
  It now prints nothing, as it does outside a Marker or ActiveValueLine in a chart of its own.
