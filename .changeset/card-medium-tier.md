---
"@elmeragroup/fuse": minor
---

A Card now pads its sections, the gaps between them and a horizontal card with the medium surface
tier, `--surface-pad-md`: 16px comfortable and 12px dense, down from 24px and 16px. The card's
text then starts on the same edge as the Items and Accordion items around it. CheckboxCard and the
TextField `card` box follow, because both sit on a default card.

`Card.Root` takes `size="lg"` for the previous large tier, `--surface-pad-lg`, for a card that holds
long prose or acts as a page's main panel. The root writes the size as `data-size`, and
`cardVariants` takes the same `size` axis. Inner corners stay concentric at both sizes.
