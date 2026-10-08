---
"@elmeragroup/fuse": minor
---

A checked `RadioItem` or `CheckboxItem` row draws its border in a new theme role,
`--selection-checked-border`. Internal themes keep the `--primary` edge. External themes set it to
`var(--border)`, so a checked row keeps its resting border and the control alone shows the
selection, as the external radio card does. Before, every theme outlined the checked row in
`--primary`. A host that maps its own tokens onto Fuse roles can set the role directly; without
it the row falls back to `--primary`.
