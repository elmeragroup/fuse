---
"@elmeragroup/fuse": patch
---

`TextField` with `filter="numeric"` counts `maxLength` in digits. Before, the browser cut a pasted
value to `maxLength` characters before the filter stripped the separators, so `912 34 567` pasted
into a `maxLength={8}` field became `912345`. Now the digits that fit land at the caret.
