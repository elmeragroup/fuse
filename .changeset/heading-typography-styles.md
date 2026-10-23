---
"@elmeragroup/fuse": minor
---

`Heading` takes a `typography` prop, `"large"`, `"medium"`, `"small"` or `"xsmall"`, which sets the
size, line height and weight together from one of the design's named heading styles at any level.
Twelve new theme roles hold the styles, `--heading-<style>-size`, `--heading-<style>-leading` and
`--heading-<style>-weight`. External themes set the bold heading ramp, large 34/40, medium 28/34,
small 24/32 and xsmall 20/32, all at 700; internal themes set 36/49.5, 30/41.25, 24/33 and
18/24.75, all at 500. `typography` cannot be combined with `size` or `font` in TypeScript; a
JavaScript caller that passes both gets the style. A `className` still wins.

The level roles `--heading-1-*` to `--heading-3-*` now point at the styles: h1 at heading small and
h2 at heading xsmall in every theme, and h3 at heading xsmall in external themes. No heading
without `typography` changes its computed type, and a theme rule that sets a style moves the levels
that point at it. `TimelineList.Title` forwards `typography`, which then replaces its pinned type.
The Figma sync offers the style sizes, line heights and weights in the matching pickers, and the
level variables alias the style they point at.
