---
"@elmeragroup/fuse": patch
---

Button's shipped doc strings now carry the usage rules the docs page used to state in prose.
`children` documents the `data-icon` markers, the 16px icon size and its `size-auto` opt-out, and
logos without a `viewBox`. `className` documents padding overrides, and `pendingIndicator` how a
custom pending state fades its content. `variant` gains a description, and `variant` and
`size` now declare their `"default"` value where Button reads them, so the API reference shows it.
The types accept the same props as before, and rendering is unchanged.
