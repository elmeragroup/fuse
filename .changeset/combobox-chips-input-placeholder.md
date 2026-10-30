---
"@elmeragroup/fuse": patch
---

`Combobox.Chips` and `Combobox.ChipsInput` look like `Combobox.Input` beside them.

- The chips box takes the shared field chrome, fill included, so it paints the `card` role
  rather than staying transparent. In external themes it is white on the tinted page, as the
  `Combobox.Input` box is. A disabled or read-only input in it gives the box the same disabled and
  read-only fills as `Combobox.Input`.
- `Combobox.ChipsInput` paints its placeholder in `muted-foreground`, as `Combobox.Input` and the
  other field inputs do. It used to fall back to the reset's half-transparent text colour, so a
  chips placeholder read lighter than the placeholder of a `Combobox.Input` beside it.
