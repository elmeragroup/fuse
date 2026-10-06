---
"@elmeragroup/fuse": patch
---

An open `DatePicker` or `DateRangePicker` calendar inside a `ThemeScope` that clips its overflow
now moves to the side of the field with room when the viewport, the scope, the field or the
calendar changes size. Before, it kept the side it opened on, so a viewport that shrank under an
open calendar clipped its last rows.
