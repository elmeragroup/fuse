---
"@elmeragroup/fuse": patch
---

`Toast.useToastManager()` now returns `add`, `update`, `close` and `promise` with the same identity
across renders. Before, each method changed identity whenever a toast was added, updated or closed, so
an effect that listed `add` as a dependency ran again after every toast and added toasts until React
stopped with "Maximum update depth exceeded".
