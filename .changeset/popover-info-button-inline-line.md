---
"@elmeragroup/fuse": patch
---

`PopoverInfoButton` defaults to `size="icon-inline"` instead of `icon-sm`. Beside a `Field.Label`'s
text the trigger now centres on the label's line and keeps the label one line tall. Before, the
taller `icon-sm` square sat lower than the text and pushed the field's input down. Pass
`size="icon-sm"` for the previous trigger.

`Button` at `size="icon-inline"` inherits the font family, weight, size and line height of the
line it sits in, so the square is as tall as that line without Tailwind's preflight too. Before,
a native button in a preflight-free host kept the browser's own font and Button's medium
weight, and could come out shorter or taller than the line. In running text the square aligns to the top of the line instead of the
baseline, so it no longer makes the line taller. A consumer `font-*`, `text-*` or `leading-*`
class still sets the square's line.
