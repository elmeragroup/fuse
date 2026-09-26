---
"@elmeragroup/fuse": patch
---

`DatePicker` opens its calendar on the `placeholderValue` month when there is no value, instead of the current month. A set value still wins, and clearing the value returns the calendar to the placeholder month.
