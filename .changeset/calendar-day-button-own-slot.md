---
"@elmeragroup/fuse": patch
---

A calendar day button rendered through `render` with its own `data-slot` now behaves like the
default one. Opening a `DatePicker` or `DateRangePicker` focuses its tab-stop day, and a key move
between such days keeps the calendar's focus through a remount of its day buttons.
