---
"@elmeragroup/fuse": patch
---

`Combobox.ChipsInput` paints its placeholder in `muted-foreground`, as `Combobox.Input` and the
other field inputs do. It used to fall back to the reset's half-transparent text colour, so a chips
placeholder read lighter than the placeholder of a `Combobox.Input` beside it.
