---
"@elmeragroup/fuse": patch
---

`DatePicker` and `DateRangePicker` now stay inside a parent that sizes to its content, such as an
inline-block, when that parent has less room than the field's one line. The parent takes the room
it has, down to the field box's minimum width. A `DateRangePicker` wraps its rows when one line
does not fit, and a row scrolls its segments only when they are wider than the row. Before, such a
parent kept the width of the field's whole line or its widest row, so a picker in a 256px panel that
clips drew its trigger past the panel's edge. In a grid column sized `1fr`, a picker now takes the
column's width down to the field box's minimum instead of widening the column.

The Root of both pickers is now a grid of one column in place of a flex column. A flex direction or
flex-wrap utility passed to the Root no longer applies, and a gap utility still does. `items-center`
on the Root, or on `DateRangePickerField`, no longer centers the label, description and error across
the field. Pass `justify-items-center` for that.
