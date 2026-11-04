---
"@elmeragroup/fuse": minor
---

A cartesian series can take a threshold colour (`@elmeragroup/fuse/chart`), which paints its values
in one role above a number and in another at or below it, such as a spot price above and below the
period's average:

```ts
color: {
  threshold: average,
  below: { color: "chart-sentiment-positive", label: "Below average" },
  above: { color: "chart-sentiment-negative", label: "Above average" },
}
```

A line and an area change colour where they cross the threshold, and a bar, an emphasis box, a dot,
a marker, the active dot, the tooltip swatch and `Glow`'s halo take their own value's side. The legend shows one entry per side
with its label, and the tooltip, the table and spoken text keep the series' own `label`. Pass the
same number to a `ReferenceLine` to show the split. On a stacked `Line` or `Area` a threshold throws
`scale-colour-on-stack`, as a scale does. A threshold that is not a finite number throws
`non-finite-threshold` in development, and production paints every value in the `below` role. Pie,
radial and radar config reject a threshold at the type level. The new types are
`ChartThresholdColor` and `ChartThresholdSide`.

On a series coloured by a scale, dots, markers, the active dot, a path-form bar's emphasis box and
`Glow`'s halo take their own value's step too, not the scale's middle step.
