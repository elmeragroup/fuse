---
"@elmeragroup/fuse": patch
---

The `alignItemWithTrigger` docs on `Select.Content` now name a Base UI 1.8 limitation. An
item-aligned popup is placed in viewport coordinates, so inside a portal target that is, or sits
inside, the containing block for `position: fixed` content, such as a transformed or
`contain: paint` scope, the list opens away from its trigger. Pass `alignItemWithTrigger={false}`
there.

The react-aria fields' error message has `role="alert"`, like Fuse `Field`'s error. `DateField`,
`DatePicker`, `DateRangePicker` and `SearchField` now announce an error when it appears, and
`aria-describedby` still ties it to the field.

The calendars of `DatePicker` and `DateRangePicker` stay inside a `ThemeScope` or `container`
that clips its overflow. React Aria 3.52.1 mixes page and containing-block coordinates when it
measures the room around a popover in a positioned scope, so a calendar under a field near the
scope's bottom edge opened downward and lost its last rows. Inside a clipping portal target,
Fuse now measures the trigger and the visible part of the target as the calendar opens. It
opens the calendar below the field when it fits there, above it otherwise, and keeps its
alignment with the field. Other portal targets keep React Aria's placement.
