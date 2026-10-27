---
"@elmeragroup/fuse": patch
---

`TextareaField` sets its label 4px from the textarea at both densities, as `TextField` does. Before,
its label sat at the field gap, 12px at dense and 16px at comfortable.
