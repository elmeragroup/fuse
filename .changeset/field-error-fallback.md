---
"@elmeragroup/fuse": minor
---

`Field.Error` without children now shows the field's own validation message, as Base UI's
`Field.Error` does: an error from Base UI's `Form` under the field's name, a `validate` result or
the browser's constraint message, as a list when there are several. Before, it rendered nothing, so
a field could turn invalid without a message. TextField, NumberField, TextareaField, CheckboxGroup
and RadioGroup do the same when `errorMessage` is falsy. PhoneNumberField shows its visible input's
constraint message, but a `Form` error under its `name` still has to be passed as `errorMessage`.

Fields that relied on an empty `Field.Error` staying silent now show the browser's message, in the
browser's language, once they validate: after Enter, on blur with `validationMode="onBlur"`, or
when a Base UI `Form` submits. Pass children or `errorMessage` to keep your own copy. Like Base
UI's, an empty `Field.Error` must sit inside `Field.Root`; outside one it used to render nothing
and now throws.
