---
"@elmeragroup/fuse": minor
---

`DateRangePicker` (`@elmeragroup/fuse/react-aria/date-range-picker`) takes a `presetGroup` and
shows it beside the range calendar inside the popover, as `DatePicker` does. Build the pane
from the new `DateRangePickerPresetGroup` and `DateRangePickerPresetItem` parts. Each preset
reports its `value`, and your `onChange` maps that value to a range. When a preset commits a
range in another month, the open calendar moves to the range's start month. If the user has
picked only the first date and then moves to the presets, the picker drops that date instead
of committing a one-day range.

`DatePicker` now opens on a `placeholderValue` that comes through `DatePickerContext`. Before,
an empty picker configured that way opened on the current month. `DateRangePicker` still opens
on a `placeholderValue` from `DateRangePickerContext`.
