---
"@elmeragroup/fuse": minor
---

`SparklineHover`, a new client component in `@elmeragroup/fuse/chart`, wraps one or more
`Sparkline`s and makes their hover glide instead of cross-fade. Once it hydrates, one dashed
crosshair, one dot and, on a line or an area, one band that re-strokes the line move from value to
value on the spring a chart's crosshair follows, which quickens with the pointer and picks up from
wherever the marks show mid-glide. A hovered bar still lifts at once. Under
`prefers-reduced-motion` the marks move at once, and turning it on ends a glide that is running.
New data or a pointer that already rests on a value as the wrapper hydrates places the marks at
once on the hovered value, and the marks glide in shares of the box, so a resize keeps them on it.
A Sparkline inside nested wrappers follows the nearest one, and keeps its CSS hover until that one
hydrates. A Sparkline with `data-hover="none"` has no hover to move, and the wrapper leaves it be.

A server component can render it around server-rendered Sparklines: it reads each value's place
from their markup, so the data never crosses to the client as props. Before it hydrates, or with no
script, the Sparklines keep their CSS hover, and a Sparkline outside a `SparklineHover` still ships
no client JavaScript. Each Sparkline with hover now writes one hidden set of glide marks beside its
hover regions for `SparklineHover` to move, and the wrapper marks that group, never the svg, so
hydration still checks the svg's own attributes, its accessible name included.
