---
"@elmeragroup/fuse": patch
---

A focused scrolling `Table.Root` in a `Frame.Root` now shows its whole focus outline, over a sticky
cell too. Chromium painted the framed table body over the outline wherever body rows were, so most of
it was hidden.
