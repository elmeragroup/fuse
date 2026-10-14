---
"@elmeragroup/fuse": patch
---

The `ButtonGroup` docs now say that filled `default` and `secondary` Buttons need a `ButtonGroup.Separator` between them. Their fill runs under the transparent border, so without one the joined segments read as one button.
