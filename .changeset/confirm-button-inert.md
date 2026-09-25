---
"@elmeragroup/fuse": patch
---

`ConfirmButton` ignores presses while `isPending` or `isVisuallyDisabled` is set, as it already did for `disabled`, and disarms when either turns on. A visually disabled button no longer confirms after two presses, and a button armed before it went pending no longer confirms on the next press after pending clears.
