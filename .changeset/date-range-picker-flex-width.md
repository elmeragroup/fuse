---
"@elmeragroup/fuse": patch
---

`DateRangePicker`'s JSDoc now says how to keep the dates on one row inside a flex row. The
picker takes no width from its content there, so give it `w-96 shrink-0`.
