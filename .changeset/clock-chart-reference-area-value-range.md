---
"@elmeragroup/fuse": patch
---

A `ClockChart.ReferenceArea` band over `y1` and `y2` now prints its range as `Chart.ReferenceArea`
does. When both ends write the same text after the number, it prints once, as in `5–10 kWh` rather
than `5 kWh–10 kWh`, and the lower value prints first when `y1` is greater than `y2`. Before, it
printed `y1` first, while readers already heard the range low to high.
