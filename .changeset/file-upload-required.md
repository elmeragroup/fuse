---
"@elmeragroup/fuse": minor
---

`FileUpload.Root` takes `required`, which asks for at least one file in the controlled `files`; an
empty or missing `files` counts as no file. A native form's submit with no files then stops and moves
focus to the first enabled `FileUpload.Trigger`. Inside a `Field.Root`, the FileUpload is now a Field
control with `files` as its value: the Field validates it as its `validationMode` says, on the
Trigger's blur in `onBlur` mode, and on a Base UI `Form` submit, which focuses the Trigger when no
file is there. `Field.Error match="valueMissing"` then describes the Trigger and marks it
`aria-invalid`, and `onFormSubmit` receives `files` under the Field's `name`.
