---
"@elmeragroup/fuse": patch
---

`Combobox.Input` inside a `Field` no longer submits its text. It rendered through `Field.Control`, which named the visible input after the Field, or after `Combobox.Root`'s `name`. So FormData carried the selected item's label, or a half-typed search, ahead of the value, and `formData.get(name)` returned the label. The input is now a plain `<input>` with the same classes, and Base UI's hidden input alone submits the value.
