---
"@elmeragroup/fuse": minor
---

A `RadioItem` or `CheckboxItem` row draws its 1px edge in a new theme role, `--selection-border`,
and the line between the stacked rows of a vertical group in two more, `--selection-divider` and,
above and below a checked row, `--selection-checked-divider`. Internal themes alias them to
`--border` and the checked row's `--primary` edge, so they look as before. External themes draw no
outer edge: `--selection-border` is a zero-alpha colour, `oklch(0 0 0 / 0)`, and a checked row
keeps it, so the control alone shows the state. Stacked rows keep a grey `--border` separator
between them, checked or not. Before, every external row was outlined in the grey `--border`. The
border keeps its width, so rows join and inset as before. On a `--card`-coloured surface an external
row now has no outline. `Item` outlines and `CheckboxCard` keep `--border`. A host that maps its own
tokens onto Fuse roles can set the roles directly; without them the row and its dividers fall back
to `--border`, and a checked row to `--primary`.
