---
"@elmeragroup/fuse": minor
---

`Sparkline` gains motion, hover and finer marks, still with no client JavaScript. With motion
allowed, a line or an area wipes in from the left as the svg enters the document and bars grow
from the baseline; under `prefers-reduced-motion` nothing moves. Re-inserting the element, as a
keyed reorder or a re-shown panel does, replays the entrance, and the new `data-intro="none"`
turns it off. On a device that hovers, the pointer over a value
shows a dashed crosshair and a dot there, fades the rest of the series and re-strokes the line
around the value, or lifts its bar, all in CSS. Hover adds no tab stop and nothing to the
accessible name.

The marks cross-fade as the pointer moves from one value to the next, and a Sparkline of any
length draws every value and its hover on the server. Hover writes about half a kilobyte of
markup per value, so the new `data-hover="none"` leaves it out where many Sparklines render at once,
such as one per row of a long table.

An area now strokes its top edge and fades its fill from 0.3 at its values to nothing at 0, up for
negative values, where the engine masks SVG elements; WebKit keeps the flat 0.3 fill. A bar rounds the corners of its far end by
`--chart-bar-radius`, which a Sparkline takes from the identity's `--radius-xs` up to 2 px, below
the baseline for a negative value. Bars now place by percentages of the box rather than a stretched
viewBox, and the zero and reference lines and the emphasis dot by percentages in every variant.
