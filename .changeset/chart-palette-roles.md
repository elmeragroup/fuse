---
"@elmeragroup/fuse": minor
---

The chart roles are now one validated palette, shared by every brand. `--chart-1` to `--chart-8`
take new values: a categorical set in a fixed cyclic order of blue, orange, aqua, magenta, green,
violet, yellow and red. Each slot holds 3:1 on the page, card, card-soft and modal surfaces of
every theme. Neighbouring slots, including slot 8 beside slot 1, stay distinguishable in normal
vision and under simulated protanopia and deuteranopia. The internal dark theme drops its five
greens and uses the same set.

New roles:

- `--chart-seq-1` to `--chart-seq-7`, a one-hue ramp for magnitude, step 1 the least.
- `--chart-diverging-1` to `--chart-diverging-7`, a blue and orange scale for values that cross
  zero, with step 4 the grey midpoint.
- `--chart-sentiment-positive` and `--chart-sentiment-negative`, favourable and unfavourable to
  the reader, such as a low and a high price.
- `--chart-other`, a grey for the series folded together past the slot count.
- `--chart-1-foreground` to `--chart-8-foreground` and `--chart-other-foreground`, the text of a
  direct label on the mark. Each is white or neutral 950, whichever contrasts more, at 4.5:1 or
  more. The theme build computes each one from its slot, so a host that overrides a slot
  also sets that slot's foreground.

`fuse.css` maps each role in `@theme`, so utilities such as `bg-chart-seq-3` and
`text-chart-1-foreground` exist.
