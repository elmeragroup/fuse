---
"@elmeragroup/fuse": minor
---

A pressed `Toggle` and `ToggleGroup.Item` fill with a new theme role, `--toggle-pressed`, and set
their label in `--toggle-pressed-foreground`. Internal themes point the pair at `--muted` and
`--foreground` again, the quiet face internal tools had before the primary fill, which turned
their pressed segments black. External themes keep the `--primary` and `--primary-foreground`
fill, which stands apart from the tinted brand pages. A host can set either role to change the
pressed face; without them a toggle falls back to `--muted` and `--foreground`.
