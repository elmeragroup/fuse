---
"@elmeragroup/fuse": patch
---

`DateRangePicker.Root` now tracks which Label, Description and Error it contains only through the
parts' registration when they mount, as `DatePicker` does. The Error registers only while it shows.
A Label wrapped in another component used to get different server HTML than one written inline. Now
both get the same. The server writes no `aria-labelledby` or `aria-describedby` that points at these
parts. The names and descriptions appear on mount.
