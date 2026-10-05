---
"@elmeragroup/fuse": patch
---

`toastManager.promise` keeps the `type` that a `success` or `error` state returns and derives the
priority from it. Before, Base UI replaced it with `"success"` or `"error"`, so a warning result
rendered as a success. `loading` is now optional; without it, no toast shows until the promise
settles.
