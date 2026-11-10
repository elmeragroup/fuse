---
"@elmeragroup/fuse": minor
---

A new preview entry, `@elmeragroup/fuse/chart`, ships Fuse's chart family. Its names and props can
change until Fuse's first stable release, so it stays out of the root barrel and every export is
tagged `@beta`. The cartesian parts, every `Bar` form, lines, areas, Panels and `Sparkline` render.
The brush renders nothing yet, and a later release adds it behind the same types.

- `Chart` with its aliases `AreaChart`, `BarChart` and `LineChart`, plus `PieChart`, `RadialChart`
  and `RadarChart`. Each starts at `Root`, which reads every series from `config` and never inspects
  its children. Shared parts such as `Tooltip`, `Legend`, `Table` and `Empty` sit under every name.
- `Sparkline`, a hook-free static chart with `role="img"` that a server component renders.
- `useChartPoint`, and the pure `formatChartValue` and `formatChartSlot`, which print the chart's own
  value and slot labels outside the chart, on the server or the client.
- Every prop is serialisable data, so a server component composes a chart. A format is Intl options
  or a Fuse preset, and a colour is a chart role, never a CSS string.

Import `@elmeragroup/fuse/chart.css` once, beside Fuse's own stylesheet. It works for
Tailwind-source and standalone consumers, before or after Fuse's CSS.

The central reduced-motion rule in `fuse.css` now also resets `transition-delay`, so a fade starts
at once instead of waiting on a stagger meant for movement, and it turns the chart keyframe
variables `--animate-chart-ping`, `--animate-chart-dash` and `--animate-chart-shimmer` off.

The cartesian chart renders under a `LocaleProvider`, which it reads for the locale and the time
zone. Every mark is SVG drawn in pixels once the browser measures the plot, so bars, rules and the
crosshair land on whole device pixels at any width and zoom. The server sends the figure, its axis
labels, legend and table, and a skeleton in the plot, which keeps its height. Bars draw one SVG
element each up to 100 slots, and vertical bars draw one path per colour step above that, with M4
decimation past 2,000 slots. A series sets its bars' look with config `barVariant`, not a `Bar`
prop, such as `"hatched"` or `"isometric"`, and its legend swatch reads the same look, so the server
HTML already shows a hatched swatch. Above 100 slots only the `"default"` and `"gradient"` looks
draw, and the rest fall back to the default. Stacks, groups, expand, horizontal bars, emphasis,
projection and quality states all render, and so do `Tooltip`, `Legend`, `LegendToggleGroup`,
`Crosshair`, `ReferenceLine`, `ReferenceArea`, `ActiveValue`, `Headline`, `Table`, `Empty`,
`Skeleton`, `Glow` and `Background`. A data update moves the bars over 480 ms, and a second update
during the move continues from where each bar is drawn. A change of `xRange` alone snaps, and
reduced motion snaps every update. The entry now depends on `d3-array` and `d3-shape`.

`Line` draws every d3-shape curve, with `step-after` and `step-before` running each reading across
its whole slot, and the `dashed`, `flowing` and `quiet` looks. `Area` fills from 0, alone or stacked
under either offset, in six looks. A missing reading leaves a gap, or a dashed bridge under config
`missing: "connect"`, a lone reading draws a dot, and the segments of estimated readings and the
tail from `projectedFrom` draw dashed on a line and hatched on an area. A scale colour paints the
value through a gradient along the value axis, so a stacked line or area, or one under
`stackOffset="expand"`, throws `scale-colour-on-stack`. A second `Line`, `Area` or `Bar` on the same
`dataKey` throws `series-drawn-twice`. `Dots`, `ActiveDot` and `Marker` with a `ValueLabel` sit on
the line's vertices, and `Glow`, `Reveal` and Root's `data-intro` wipe work on lines and areas. On a
data update a line tweens its vertices, slides when the window moves by whole slots, pairs by
position when no slot is shared and crossfades otherwise, with its dots and markers on it in every
frame. Bars in the path form move the same way. Above 2,000 slots a line draws the M4 vertices of
each pixel column. `Sparkline` draws its line, area or bars on the server, and its name ends in a
sentence that names its lowest and highest values. The `time-seconds` preset prints `13:42:04` in
nb-NO and `13.42.04` in fi-FI.

`Chart.Panel` stacks rows on one Root. Each Panel takes its own value axis, `yBaseline` and
`yInclude`, and every Panel shares Root's x grid, surface, tooltip, table and motion, so one listbox
walks every Panel and Up and Down move the series focus from one Panel into the next. A Panel that
lists only some keys of a stack throws `stack-across-panels`. The Panels align their plots through
CSS subgrid, so every slot lands on the same device pixels in each. A config entry's `interval` may
be coarser than Root's, such as hourly usage under quarter-hour prices: its bar spans its quarters,
its line's vertex sits at its hour's middle, the band crosshair spans its hour, the option and the
tooltip name its hour, and the table spans its cell over its rows. A series interval that does not
nest in Root's throws `interval-not-nested`, and a value off the series' grid warns `off-grid-x` in
production.

`Chart.SlotLabel` inside a `Crosshair` prints the active slot as a pill on the x axis, in the axis's
format, and fades the tick labels under it. Each part of the label, such as the day or the month,
rolls to its next value, so a part that stays the same stays still. Above 60 labels it prints one
label. The line crosshair fades out at both ends, `fade` picks the ends, and
`--chart-crosshair-width` sets its width. The line crosshair, the pill and the tooltip glide on
springs and move at once under reduced motion. The line crosshair's spring quickens with the
pointer, and `ActiveDot` glides with it along its series' line.

Data that breaks a rule throws in development. In production each rule warns once per column, or
once for the x axis or a stack, naming the first row and the count.
