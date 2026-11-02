---
"@elmeragroup/fuse": patch
---

`Calendar`, `RangeCalendar`, `DatePicker` and `DateRangePicker` hide the previous and next month's
days instead of drawing them like unavailable dates. Their cells keep the weeks aligned, they leave
the accessibility tree, and they remain pickable from their own month.
