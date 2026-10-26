---
"@elmeragroup/fuse": minor
---

A `Text` at `size="sm"`, the default size and `size="lg"` takes its line height from three new theme
roles, `--paragraph-leading-sm`, `--paragraph-leading-base` and `--paragraph-leading-lg`. External
themes set the paragraph styles of the external design, 14/20, 16/22 and 18/24, so a default Text
has 22px lines instead of 26px. Internal themes keep the relaxed 1.625 ratio, so nothing internal
moves. The `xs`, `xl` and `2xl` sizes stay relaxed in every theme, and, because a Text's descendants
inherit its line height, a link or child paragraph inside it follows the role too. A `leading` prop
or a `className` leading still replaces the theme's, and a `className` size such as `text-lg` drops
it as it dropped `leading-relaxed` before. `Span` keeps its snug default. A host that maps its own
tokens onto Fuse roles can set the three roles directly; without them a Text keeps the relaxed line
height. The Figma sync offers the roles in the line height picker.
