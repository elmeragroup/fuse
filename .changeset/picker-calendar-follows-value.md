---
"@elmeragroup/fuse": patch
---

`DatePicker` and `DateRangePicker` no longer remount their calendar when the value changes from
outside. The open calendar moves to the new value's month in place and keeps keyboard focus on its
day, and a form reset still opens it on the reset value. A range the parent sets while the user is
choosing one drops the half-chosen range. A parent that accepts the picker's own edit a render later,
through a transition or a deferred value, no longer moves the month the user paged to.
