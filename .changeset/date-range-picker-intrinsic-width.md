---
"@elmeragroup/fuse": patch
---

`DateRangePicker`'s root now gives its parent the width of its content. Before, it measured 0px
in a parent that sizes to its content, such as an inline-block or a `fit-content` box, and the field
box drew 208px wide past the parent with its inputs cut off. A parent that sizes to its content and
has the room, such as a roomy inline-block, now takes the two inputs, separator and trigger on one
line. With less room, such a parent takes the room it has, down to the field box's 208px minimum.
