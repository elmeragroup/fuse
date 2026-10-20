---
"@elmeragroup/fuse": patch
---

A neutral `AlertDialog.Content` with `isActionDisabled` now opens with focus on Cancel. Before,
initial focus aimed at the disabled action, did nothing, and left focus on the trigger behind
the modal.
