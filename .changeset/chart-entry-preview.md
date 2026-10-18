---
"@elmeragroup/fuse": minor
---

A new preview entry, `@elmeragroup/fuse/chart`, ships Fuse's chart family. Its names and props can
change until Fuse's first stable release, so it stays out of the root barrel and every export is
tagged `@beta`. The parts render nothing yet. Later releases add the rendering behind the same types.

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
