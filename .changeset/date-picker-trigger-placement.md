---
"@elmeragroup/fuse": minor
---

`DatePicker` takes `triggerPlacement`. Set it to `"start"` to put the calendar button before the
date segments, so the button comes first in the field box, in tab order and on screen. Clicking
the label then focuses the button. The default, `"end"`, keeps the button after the segments.
`DateRangePicker` keeps its button at the end and does not take the prop.
