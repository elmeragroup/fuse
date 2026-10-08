---
"@elmeragroup/fuse": minor
---

A `RadioItem` or `CheckboxItem` row title takes its weight from a new theme role,
`--selection-title-weight`. External themes set it to 500, the weight of the group legend and a
`CheckboxCard` title, and internal themes keep 400. Before, every theme set row titles at 400. A
`className` weight on the title still replaces the theme's. A host that maps its own tokens onto
Fuse roles can set the role directly; without it titles stay at 400. The theme catalog gains a
`fontWeight` token kind, which the Figma sync writes as a number variable with the font weight
picker.
