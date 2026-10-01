---
"@elmeragroup/fuse": minor
---

`Button` takes `wrap` on its label sizes. A wrapping button lets a long label break onto more lines and grows one line height per line, centered, instead of overflowing on a narrow screen. A one-line label measures exactly as before, so `wrap` can sit on every call to action. The control-size recipe gains the matching `wrap` fit (`controlSize({ size, fit: "wrap" })` and `controlWrap(size)`), and `buttonVariants({ wrap: true })` serves recipe-only consumers.
