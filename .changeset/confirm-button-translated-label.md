---
"@elmeragroup/fuse": patch
---

`ConfirmButton` now swaps between its resting and armed labels on a page that Chrome's built-in
translation has translated. Each run of text in `children` and `armedChildren`, fragments included,
renders in its own `<span>`. Before, the swap threw `NotFoundError` when one label was an element
or a fragment, and left the translated old label showing when both were text.
