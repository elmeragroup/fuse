---
"@elmeragroup/fuse": patch
---

`ConfirmButton` now shows its armed label on a page that Chrome's built-in translation has
translated. Text in `children` and `armedChildren` renders in its own `<span>`. Before, arming
threw `NotFoundError` when `armedChildren` was an element, and left the translated resting label
showing when it was text.
