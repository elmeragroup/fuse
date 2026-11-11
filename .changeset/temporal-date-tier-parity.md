---
"@elmeragroup/fuse": minor
---

The Temporal date tier closes its gaps with the interim React Aria tier:

- `DatePicker.TimeInput`, `DateRangePicker.StartTimeInput` and `DateRangePicker.EndTimeInput` edit
  the value's time in the popup under the calendar, and `DatePickerField` and `DateRangePickerField`
  show them for a time `granularity`. A day picked with `shouldCloseOnSelect={false}` in an empty
  picker commits at the time typed there, rather than at midnight.
- A day picked in `DatePicker` or `DateRangePicker` over a value with a time moves the time as
  React Aria does: a wall time the zone repeats on the picked day, such as 02:30 on the night the
  clocks go back, takes the earlier instant, as a typed time does, rather than keeping the value's
  offset. A day picked again keeps its value as it is.
- A preset's `dateValue` (`DatePicker.PresetItem`) sets the picker's value through `onValueChange`
  with the reason `"preset-press"`.
- Typing a `DateRangePicker` start's last segment moves on to the end's first; Backspace and the
  arrow keys cross back.
- A granularity change that removes the focused segment moves focus to the segment before it.
- An empty zoned field names its zone as it is today, read once mounted.
- Paste takes text in the field's own format, such as `10/05/2026` in en-US, beside ISO text.
- A `Calendar` with neither `value` nor `defaultValue` renders its months' frame on the server and
  while hydrating, instead of no months.
