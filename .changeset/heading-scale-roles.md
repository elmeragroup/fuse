---
"@elmeragroup/fuse": minor
---

A `Heading` at level 1, 2 or 3 takes its default size, line height and weight from nine new theme
roles, `--heading-1-size`, `--heading-1-leading` and `--heading-1-weight` and the same for levels 2
and 3. External themes set the external design's heading styles: an h1 is heading small, 24/32, and
an h2 or h3 is heading xsmall, 20/32, all at 700. Before, an external h1 was 24/33, an h2 18/24.75 and
an h3 16/22, all at 500. Internal themes keep those values, so nothing internal moves, and h4 to h6
stay 16/22 at 500 in every theme. A `size` prop still replaces a level's size and line height, a
`font` prop its weight, and a `className` size or weight still wins. A host that maps its own tokens
onto Fuse roles can set the roles directly; without them headings keep the internal scale.
`headingVariants()` on its own knows no level and keeps the plain scale. `TimelineList.Title` keeps
its earlier type in every theme, 24/33 at level 1, 18/24.75 at level 2 and 16/22 below, all at 500,
and the `Calendar` month title stays 18/24.75 at 500. The Figma sync offers the sizes in the
font size picker, the line heights in the line height picker and the weights in the font weight
picker.
