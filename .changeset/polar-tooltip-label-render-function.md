---
"@elmeragroup/fuse": patch
---

A pie, radial, radar or clock tooltip now sizes itself for the text a `TooltipLabel` `render`
function or component prints. Before, one that printed the item's name on the first step, such as
one that abbreviates only long names, made the popup as wide as the longest name it never printed.
In a short viewport that popup took the lane above the chart and opened partly out of view. With a
`render` function or component, the popup measures the content it shows, and measures it again
whenever that content changes, such as a label that names the series as the focus moves between a
radar's series. The popup keeps the largest width it has measured for the same chart data, across
steps and reopenings. A popup in a side lane is at most 256 px wide, so a wider label wraps there.
A `TooltipLabel` without `children` still opens as wide as the longest name when it has no
`render`, or a `render` element of an HTML tag without children of its own, such as `<strong />`.
