---
"@elmeragroup/fuse": patch
---

Chromium reported the focused chart point as selected, so a screen reader announced each point as
"selected" while you browsed the plot or a tooltip was pinned. Chromium still reported a
`LiveLineChart` point as selected after Escape dismissed its readout. The plot options of `Chart`,
the polar charts, `ScatterChart` and `LiveLineChart` now state `aria-selected="false"`, and
Chromium reports the focused point as unselected.
