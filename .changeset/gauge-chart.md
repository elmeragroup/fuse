---
"@elmeragroup/fuse": minor
---

Add `GaugeChart` to the preview chart entry, `@elmeragroup/fuse/chart`. Root takes one `value` on a
dial from `min` to `max`, in the value's own unit and format, and names the dial as a meter with the
value's spoken text, so the chart has no tab stop. A value past either end draws at that end and
sets `data-over-max` or `data-under-min`, while the centre and the meter keep the true number.
`Track` draws 40 notches or a solid band, `Fill` and `Glow` light it up to the value, `Zone` marks a
range at the rim, `Ruler` stands inside or outside the track with labels at its majors, and `Needle`,
`Sector`, `ProgressRing` and `Dots` read the same value, so a gauge may leave the track out. The
layers lay out from the rim inward with no radius to tune. `Center`, `CenterValue`, `CenterLabel`,
`Empty`, `Skeleton`, `Headline` and `Takeaway` complete it. On first view the fill sweeps in from
`min` and every part follows it in each frame, and a new value sweeps on from where the dial shows.
