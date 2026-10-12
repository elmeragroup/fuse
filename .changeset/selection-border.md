---
"@elmeragroup/fuse": minor
---

A `RadioItem` or `CheckboxItem` row draws its 1px edge, and the line between the rows of a vertical
group, in a new theme role, `--selection-border`. Internal themes keep `var(--border)`, so they look
as before. External themes draw no edge: the role is a zero-alpha colour, `oklch(0 0 0 / 0)`, and a
checked row keeps it, so the control alone shows the state. Before, every external row was outlined
in the grey `--border`. The border keeps its width, so rows join and inset as before. On a
`--card`-coloured surface an external row now has no outline, and grouped rows have no divider.
`Item` outlines and `CheckboxCard` keep `--border`. A host that maps its own tokens onto Fuse roles
can set the role directly; without it the row falls back to `--border`.
