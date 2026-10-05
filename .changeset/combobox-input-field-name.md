---
"@elmeragroup/fuse": patch
---

`Combobox.Input` inside a `Field` no longer submits its text. It rendered through `Field.Control`, which named the visible input after the Field, or after `Combobox.Root`'s `name`. So FormData carried the selected item's label, or a half-typed search, ahead of the value, and `formData.get(name)` returned the label. The input is now a plain `<input>` with the same classes, and Base UI's hidden input alone submits the value.

Inside a `Field`, the id that `Field.Label` points at is now `Combobox.Root`'s `id`, as in Base UI. Before, `Field.Control` replaced it with a generated id. An `id` set on `Combobox.Input` still names the input, but the label's `for` no longer reaches it, so move it to `Combobox.Root`.
