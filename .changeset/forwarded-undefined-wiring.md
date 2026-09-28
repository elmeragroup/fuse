---
"@elmeragroup/fuse": patch
---

Field wiring survives props forwarded as `undefined`. Before, an `aria-labelledby={undefined}` on `Input`, `Field.Control`, `Combobox.Input`, `Combobox.ChipsInput` or `Combobox.Trigger` dropped the Field label reference, and on `Field.Set` it dropped the legend name. An undefined `aria-labelledby`, `aria-describedby` or `role` on `Sheet.Content` dropped the dialog's name, description and role.

`TextareaField` inside a disabled `Field.Set` is now disabled. Before, it stayed editable.
