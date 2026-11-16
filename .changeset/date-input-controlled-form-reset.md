---
"@elmeragroup/fuse": patch
---

A controlled `DateInput` and `DateField` now take part in a form reset. The reset drops a
half-typed draft and clears the Field's error, touched and dirty state, a validation still pending,
and the native validity a Field `validate` installed. The value stays the parent's, and the reset
reports no change, as a controlled native input does. `DatePicker` and `DateRangePicker` reset
their inputs this way instead of remounting them, so focus stays where it was.
