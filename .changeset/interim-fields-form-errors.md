---
"@elmeragroup/fuse": minor
---

`Form`'s `errors` now reach the interim react-aria fields. `DateField`, `DatePicker` and
`SearchField` show the error under their `name`, and `DateRangePicker` the errors under its
`startName` and `endName`, when they get no `errorMessage`, and are marked invalid. A change to the
field's value clears its error, and a new `errors` object shows it again. Before, they read only
React Aria's own form context, so a form mixing them with Base UI fields needed a second error path.
