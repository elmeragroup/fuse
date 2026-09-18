---
"@elmeragroup/ui": minor
---

`Skeleton` now takes `silhouette="rounded" | "circle"`, defaulting to `rounded`, so a circular
placeholder no longer restyles `rounded-full` through `className`. Your sizing and colour classes still
merge last, and a conflicting radius keeps winning through the merge.
