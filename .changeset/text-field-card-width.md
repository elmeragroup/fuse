---
"@elmeragroup/fuse": minor
---

`TextField variant="card"` now stretches the input across the card. Before, the input kept its
intrinsic width, so a long value scrolled inside a box narrower than the card and the
description sat mid-row instead of at its end. The description now ends the row and takes at
most half of it, so a long one wraps instead of squeezing the input. `textFieldVariants` gains an
`inputContainer` slot for the input's wrapper, which fills the row under the card variant.
