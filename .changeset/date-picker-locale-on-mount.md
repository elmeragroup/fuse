---
"@elmeragroup/fuse": patch
---

`DatePicker` and `DateRangePicker` now throw the missing-`LocaleProvider` error when they mount.
Before, a picker rendered without the required provider worked until the user first opened its
calendar, and only then fell to the nearest error boundary.
