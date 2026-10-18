---
"@elmeragroup/fuse": minor
---

`Card` casts its `shadow-xs` in a new theme role, `--card-shadow`. Internal themes set it to
Tailwind's own `shadow-xs` colour, black at 5%, so they look as before. External themes cast no
shadow: `--card-shadow` is a zero-alpha colour, `oklch(0 0 0 / 0)`, in light and dark, as the
external order flows draw their cards. Before, every external `Card` cast the 5% black shadow. The
shadow keeps its geometry, so a brand or host can tint it back by setting `--card-shadow`.
`CheckboxCard` and the TextField `card` box keep the plain `shadow-xs`. A `shadow-*` class on a
`Card` still replaces the shadow, in that class's own colour. A box you build from
`cardVariants().base()` takes `--card-shadow` too, so add `shadow-xs` where it must keep its
elevation, as `CheckboxCard` and the TextField `card` box do. A host that maps its own tokens onto
Fuse roles can set the role directly; without it cards fall back to the 5% black shadow.
