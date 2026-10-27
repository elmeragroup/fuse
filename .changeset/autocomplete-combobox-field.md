---
"@elmeragroup/fuse": minor
---

Add `AutocompleteField` and `ComboboxField`, labeled fields laid out like `TextField` and
`SelectField`: the label 4px from the input at both densities, the input filling the field's width,
then the error ahead of the description.

- `AutocompleteField`, from `@elmeragroup/fuse/autocomplete`, submits the text in its input.
  `ComboboxField`, from `@elmeragroup/fuse/combobox`, submits the option the user selected and takes
  one selection. Both are in the root barrel and render on the server, since they own no state.
- Both take `label`, `description`, `errorMessage`, `isInvalid`, `isRequired`, `isDisabled` and
  `name`, the input's `placeholder`, `showTrigger` and `showClear`, `inputClassName`, and a `ref`
  to the input. The props they do not name themselves go to the Root, such as `value`,
  `defaultValue`, `onValueChange`, `itemToStringValue`, `filter` and `id`, which the label points
  at.
- `items`, flat or grouped, gives `itemToStringValue` and the other callbacks the item type, as
  `Autocomplete.Root` does, and `filteredItems` does without `items`. For `ComboboxField`, the item
  type is also the selected value's type.
- Inside a `Form`, the field shows the error `Form` holds under its `name`, also in the first
  server-rendered HTML, until the user edits the text or changes the selection.
- Pass the popup's content, such as `Autocomplete.Empty` and `Autocomplete.List`, as children.
  `AutocompleteField`'s `status` renders in `Autocomplete.Status` beside the input, which stays
  mounted while the popup opens and closes.
- Compose `Field.Root` and the parts for multiple selection, chips or a layout of your own, such as
  a label row with an info button or a horizontal field.
