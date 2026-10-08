---
"@elmeragroup/fuse": patch
---

An invalid `DatePicker`, `DateRangePicker`, `DateField` or `SearchField` now paints its label in
the error colour, as an invalid `TextField` does. Before, those labels kept the normal text colour
while the field box and error message showed the error.
