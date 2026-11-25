---
"@elmeragroup/fuse": patch
---

A `DateField`, `DatePicker` or `DateRangePicker` box narrower than its segments now scrolls the
segment row inline, with no scrollbar. Focusing a segment scrolls the row until the whole segment
shows when it fits in the row, also under a scaled ancestor, and the row scrolls again when a paste
or a resize moves the focused segment. The row scrolls back to its start when focus leaves and when the field is disabled. A segment cut off at the row's edge used to stay cut off, as did the AM/PM
segment of a date and time to the second at the 150px floor.

A `DateRangePicker` box now grows to hold its lines when its ends or its calendar button wrap, and
keeps the field height when they fit on one line. From 24rem the box kept the field height, so a
range with a time, or with large field text, cut off its end row and the calendar button. Below
24rem a range box that fits on one line was 6px shorter than the field height at comfortable
density.
