---
"@elmeragroup/fuse": patch
---

`AlertDialog.Root` now runs Base UI's alert-dialog mode, so every alert dialog is modal and a
backdrop click no longer dismisses it. Escape still closes it. `modal` and
`disablePointerDismissal` are no longer accepted on `AlertDialog.Root`.
