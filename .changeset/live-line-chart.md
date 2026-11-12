---
"@elmeragroup/fuse": minor
---

Add `LiveLineChart` to the preview chart entry, `@elmeragroup/fuse/chart`. It draws one value over a
time window that scrolls with the clock, its right edge always now, from a feed of timestamped
readings the app owns: `data`, an optional `value` for the latest value, and `windowMs`. The window
moves every frame, a new reading grows out of the last one on the chart's update curve, and the
value axis eases to fit. `Grid`, `XAxis` with round wall-clock ticks that fade at the edges,
`YAxis`, `Area` with a gradient fill, `Line`, `LiveDot` with a ping ring, `Badge` with rolling digits,
`Crosshair`, `Tooltip` and `Table` complete it. The plot is one tab stop whose option walks the
window's readings, and the loop stops while the chart is out of view or its tab is hidden. Under
reduced motion each new reading redraws the window once, at rest. `paused` holds the window while
the readings keep arriving.
