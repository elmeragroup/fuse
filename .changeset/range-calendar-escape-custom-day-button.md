---
"@elmeragroup/fuse": patch
---

Escape on a `RangeCalendar` day now drops a range being chosen even when the day button renders
through `render` with its own `data-slot`. As before, it goes no further while a range is open, so
an enclosing popup stays open, and passes through when none is.
