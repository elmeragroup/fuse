---
"@elmeragroup/fuse": patch
---

`DateRangePicker`'s root now gives its parent the width of its content. Before, it measured 0px
in a parent that sizes to its content, such as an inline-block or a `fit-content` box, and the field
box drew 208px wide past the parent with its inputs cut off. A parent that sizes to its content and
has the room, such as a roomy inline-block, now takes the two inputs, separator and trigger on one
line. With less room, such a parent with no width limit of its own is never narrower than the
widest input's dates, or 208px where that is wider, so it can overflow a narrower container, where
the inputs used to scroll inside the collapsed field (#1117). A `max-width` on the parent keeps the
field inside and lets the inputs scroll. The single `DatePicker`'s field overflows such a
parent too, since it never wraps.
