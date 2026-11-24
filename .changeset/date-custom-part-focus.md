---
"@elmeragroup/fuse": patch
---

Date inputs and pickers keep their focus behavior when a consumer gives a part a custom `data-slot`.
For a `DateInput.Segment` with a custom `data-slot`, the left and right arrows move focus onto and
off it, within an input and from a range's start to its end. A press on the box past the segments
can focus it as it would any other segment, and an invalid form submission focuses the input's
first segment when that segment has a custom `data-slot`. A granularity change that removes the
focused segment moves focus to the surviving segment beside it, with or without a custom
`data-slot`. A touch release on the segment leaves focus on it. A `DateRangePicker.Label` press
focuses the first segment when the `DateRangePicker.Root` or its segments have a custom
`data-slot`. A `DatePicker.Popup` with a custom `data-slot` no longer calls `onFocusLeave` when
focus in the popup blurs with no next focus target.
