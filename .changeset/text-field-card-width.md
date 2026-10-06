---
"@elmeragroup/fuse": patch
---

`TextField variant="card"` now stretches the input across the card. Before, the input kept its
intrinsic width, so a long value scrolled inside a box narrower than the card and the
description sat mid-row instead of at its end. `textFieldVariants` gains an `inputContainer`
slot for the input's wrapper, which fills the row under the card variant.
