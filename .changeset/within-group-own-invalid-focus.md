---
"@elmeragroup/fuse": patch
---

`InputGroup.Root` and `Combobox.Chips`: a group marked `aria-invalid` whose own control is valid
keeps the plain focus ring. Before, it painted the invalid face only while focused. Mark the
control (`InputGroup.Input`, `Combobox.ChipsInput`) `aria-invalid` to show the invalid face.
