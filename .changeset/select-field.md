---
"@elmeragroup/fuse": minor
---

Add `SelectField` (`@elmeragroup/fuse/select-field`), a labeled select laid out like `TextField`:
the label, the trigger filling the field's width, then the error ahead of the description. It takes
`label`, `description`, `errorMessage`, `isInvalid`, `isRequired`, `isDisabled`, `name` and
`placeholder`, `Select.Root`'s `value`, `defaultValue`, `onValueChange` and `items`, and options as
`Select.Item` children. Inside a `Form` it shows the error under its `name` until the selection
changes. A `ref` and the remaining props go to the trigger. It takes one selection; compose
`Field.Root` and the `Select` parts for multiple selection or a custom layout.
