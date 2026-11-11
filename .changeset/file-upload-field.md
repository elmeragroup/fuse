---
"@elmeragroup/fuse": minor
---

`FileUpload` now works inside a `Field.Root`, with one `FileUpload.Trigger` as the Field's control;
development logs an error for a second. `Field.Label` names the Trigger after its own text, such as
"Choose file Meter photo", and a click on the label opens the picker. `Field.Description` and
`Field.Error` describe the Trigger, after the ids in its own `aria-describedby` and before each
`FileUpload.Description`. An invalid Field marks the Trigger `aria-invalid`, unless the Trigger sets
its own, and the Trigger paints the shared invalid border and ring as the FileUpload's one invalid
face; `FileUpload.Dropzone` paints none. A disabled `Field.Root` or `Field.Set` disables the
FileUpload, which `useFileUpload()` reports as `state.disabled`. Outside a Field, the parts render
as before.
