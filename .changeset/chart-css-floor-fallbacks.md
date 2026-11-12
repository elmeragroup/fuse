---
"@elmeragroup/fuse": patch
---

Charts now render in full in the oldest browsers Fuse supports. In Chrome 111–122 and Safari
16.4–17.4, which lack `light-dark()`, a `GaugeChart` track paints its notches, in the light tint in
both colour schemes. Before, the track showed no notches at all. In Chrome 111–119, a gauge
sector draws as its wedge instead of tinting the gauge's whole box. In the same versions, a
`LiveLineChart` line fades out at the plot's left edge instead of running past it. In Chrome
111–118, hovering a `Sparkline` shows its crosshair, its dot and the dimmed line instead of a
highlight segment drawn off the line. Current browsers render charts as before.
