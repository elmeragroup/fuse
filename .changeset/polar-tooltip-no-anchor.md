---
"@elmeragroup/fuse": patch
---

`PieChart.Tooltip`, `RadialChart.Tooltip`, `RadarChart.Tooltip` and `ClockChart.Tooltip` no longer
take `anchor`, which never moved them. Their shared props type is `ChartPolarTooltipProps`, which
has no `anchor`. Remove `anchor` from these tooltips when upgrading from an earlier canary.
