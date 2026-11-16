---
"@elmeragroup/fuse": patch
---

A controlled `DatePicker` or `DateRangePicker` whose parent ignores a change, without calling
`details.cancel()`, no longer carries that change into the next gesture. A later pick builds on the
parent's value. A parent that accepts a change keeps it, even when a second gesture follows in the
same task before the parent renders.
