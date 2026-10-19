---
"@elmeragroup/fuse": minor
---

`Card.Root` takes a `size`. The default keeps the large surface tier, `--surface-pad-lg`. `size="sm"`
pads the sections, the gaps between them and a horizontal card with the medium tier,
`--surface-pad-md`, which is 16px comfortable and 12px dense, and keeps the inner corners
concentric. Use it for a card of rows, such as an order summary, so its text lines up with the
Items and Accordion items around it, and at comfortable density with selection items. The root writes the size as `data-size`, and
`cardVariants` takes the same `size` axis.
