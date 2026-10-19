---
"@elmeragroup/fuse": patch
---

`Card.Title` now sets `leading-snug`, as `Heading` and `Item.Title` do, so a card title that wraps
has space between its lines. Before, `leading-none` made two wrapped lines touch. A horizontal
card's title keeps the same leading through `text-xl/snug`. A single-line title grows by the extra
leading, about 9px at the default `2xl` size.
