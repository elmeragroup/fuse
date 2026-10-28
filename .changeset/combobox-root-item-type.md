---
"@elmeragroup/fuse": minor
---

`Combobox.Root` takes its item type from `items`, as `Autocomplete.Root` and `ComboboxField` do.

- With `items`, flat or grouped, the value, `itemToStringValue`, `onValueChange` and the other
  callbacks take one item without an annotation, and a callback annotated to another type is an
  error. Without `items`, `filteredItems` sets the type, and without either, `value`,
  `defaultValue` or an annotated callback does.
- The Root's type parameters are now `Items`, `Filtered`, `Value` and `Multiple`, in that order.
  Drop explicit type arguments such as `<Combobox.Root<Fruit, true>>`: `items`, `value` and
  `multiple` set them.
- `items` takes an array, flat or of groups. A Base UI `createItems()` collection no longer
  type-checks there.
