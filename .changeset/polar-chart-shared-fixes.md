---
"@elmeragroup/fuse": patch
---

The polar charts share three fixes from `GaugeChart`'s review. `PieChart`'s, `RadialChart`'s and
`ClockChart`'s centres split a value at the number Intl writes, so a whole unit such as
`øre/kWh inkl. mva` reads small after it, a scientific `3.9E3`, a sign and a compact `1,2 mill.`
stay in the number, and a long unit wraps before its VAT basis. `PieChart.Root` and
`RadialChart.Root` throw `invalid-sweep` for a `startAngle` or `endAngle` that is not a finite
number, where an infinite one hung the render. A print draws every chart at rest with no entrance,
roll or fade still running.
