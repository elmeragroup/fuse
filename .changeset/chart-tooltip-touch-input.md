---
"@elmeragroup/fuse": patch
---

A chart tooltip lets taps through to the plot from the first touch. Before, `Chart.Tooltip` and the
polar charts' tooltips noticed a switch from mouse to touch only when the active point changed. A
touch on the point a mouse already showed left the popup taking the next tap, not the plot.
`ScatterChart` already followed the switch at once.
