---
"@elmeragroup/fuse": patch
---

`Dialog.Content` and `Field.Item` now drop props passed as `undefined`. Before, an
`aria-labelledby={undefined}` on `Dialog.Content` removed the label that ties the dialog to its
title, because Base UI merged the `undefined` over the dialog's own value.
