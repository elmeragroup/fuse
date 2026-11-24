---
"@elmeragroup/fuse": patch
---

A chart now applies its default active item when that item first becomes available after mount.
Before, `Chart.Root`, `ClockChart.Root`, `PieChart.Root`, `RadarChart.Root` and `RadialChart.Root`
looked up `defaultActiveX`, `defaultActiveKey` or `defaultActiveName` once, at mount. A Root that
mounted with no rows, as a page does while it loads, never showed the default item's active dot,
readout or Tooltip, and the first Tab focused the first item. Now the default item turns active
when the data first holds it, and focus enters on it. A dial with `now` or `period` can hold its
default slot while its rows are still empty. On `Chart.Root` the slot must also lie inside the
window, so a default outside `xRange` waits until the window holds it. While the default stays
active on a polar chart, a row inserted before it keeps the same item active, where before the
active index stayed and named the inserted row. If a reader moves the active item first, the Root
never applies the default. Root reads the prop only at mount, as with `defaultValue`, so a
default passed after mount does nothing.
