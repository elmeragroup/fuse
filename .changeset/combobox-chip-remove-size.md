---
"@elmeragroup/fuse": patch
---

`Combobox.Chip`: the remove button now fits inside the 22px chip at both densities. It rendered
Button's `icon-sm` square, 32px at dense and 36px at comfortable, which overflowed the chip. It
now renders the `icon-inline` square as tall as the chip's text line, with a 12px glyph, and its
hit area keeps the pointer target at 24px without reaching the next chip.
