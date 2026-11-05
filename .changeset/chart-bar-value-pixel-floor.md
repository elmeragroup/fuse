---
"@elmeragroup/fuse": patch
---

`Chart.Bar` draws a reading other than 0 at least one device pixel long along the value axis, at
any pixel ratio and wherever the page places the plot. A reading far below the domain's maximum,
such as 4 beside 1,000, could snap to 0 px and read as a zero while the tooltip showed its value.
The kept pixel grows from the zero rule away from zero: up for a positive vertical bar, down for a
negative one, and right or left on a horizontal chart. A zero reading stays flat. In a stack, the
outermost segment with length on each side keeps the pixel, decided again in every frame of an
update, and the inner segments snap as before, so the segments still meet with no gap or overlap. The path form above 100 categories, its emphasis boxes and the active
overlay follow the same rule.
