---
"@elmeragroup/fuse": patch
---

`TextField`, `NumberField`, `TextareaField`, `PhoneNumberField`, `DateField`, `DatePicker`,
`DateRangePicker` and `SearchField`: an error now sits directly under the control, and the
description moves below it. Before, the description always sat between the control and the
error. Without an error, the description stays directly under the control. A card `TextField`
keeps its description beside the input, with the error under that row. `CheckboxGroup` and
`RadioGroup` already put their error directly under the options, with the description under the
label, and do not change. When `TextField`, `NumberField`, `TextareaField` or `PhoneNumberField`
first renders with its error showing, screen readers now read the error before the description,
in the order they appear.

A hand-composed `Field.Root` keeps the order its children are written in. The docs now place
`Field.Error` before `Field.Description`; reorder your own fields to match.
