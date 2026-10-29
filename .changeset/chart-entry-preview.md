---
"@elmeragroup/fuse": minor
---

A new preview entry, `@elmeragroup/fuse/chart`, ships Fuse's chart family. Its names and props can
change until Fuse's first stable release, so it stays out of the root barrel and every export is
tagged `@beta`. The cartesian parts and every `Bar` form render. The line, area, brush, panel and polar
parts render nothing yet, and later releases add them behind the same types.

- `Chart` with its aliases `AreaChart`, `BarChart` and `LineChart`, plus `PieChart`, `RadialChart`
  and `RadarChart`. Each starts at `Root`, which reads every series from `config` and never inspects
  its children. Shared parts such as `Tooltip`, `Legend`, `Table` and `Empty` sit under every name.
- `Sparkline`, a hook-free static chart with `role="img"` that a server component renders.
- `useChartPoint`, and the pure `formatChartValue` and `formatChartSlot`, which print the chart's own
  value and slot labels outside the chart, on the server or the client.
- Every prop is serialisable data, so a server component composes a chart. A format is Intl options
  or a Fuse preset, and a colour is a chart role, never a CSS string.

Import `@elmeragroup/fuse/chart.css` once, beside Fuse's own stylesheet. It works for Tailwind-source
and standalone consumers, before or after Fuse's CSS.

The central reduced-motion rule in `fuse.css` now also resets `transition-delay`, so a fade starts at
once instead of waiting on a stagger meant for movement, and it turns the chart keyframe variables
`--animate-chart-ping`, `--animate-chart-dash` and `--animate-chart-shimmer` off.

The cartesian chart renders under a `LocaleProvider`, which it reads for the locale and the time
zone. It draws bars as HTML boxes up to 100 slots and as one path per series above that, with M4
decimation past 2,000 slots. Stacks, groups, expand, horizontal bars, emphasis, projection and
quality states all render, and so do `Tooltip`, `Legend`, `LegendToggleGroup`, `Crosshair`,
`ReferenceLine`, `ReferenceArea`, `ActiveValue`, `Headline`, `Table`, `Empty`, `Skeleton`, `Glow`
and `Background`. A data update moves the bars over 480 ms, a change of `xRange` alone snaps, and
reduced motion snaps every update. The entry now depends on `d3-array` and `d3-shape`.
