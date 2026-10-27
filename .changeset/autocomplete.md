---
"@elmeragroup/fuse": minor
---

Add `Autocomplete`, a form field whose value is the text in its input.

- `Autocomplete`, from `@elmeragroup/fuse/autocomplete` and the root barrel, wraps Base UI's
  Autocomplete with Combobox's look. Its list only suggests: picking an item fills the input with
  the item's text, and the user can go on editing it. Text that matches no item is kept on blur.
- `Root` takes Base UI's `value`, `defaultValue`, `onValueChange`, `name`, `itemToStringValue`,
  `filter` and the rest, and filters in the locale of `LocaleProvider`. The input carries `name`,
  so the form submits the text, once, under the enclosing `Field.Root`'s name, or under `name`
  outside one.
- Inside a `Field.Root`, the label, description and `Form` errors reach the input, and editing
  clears an error. Set `id` on the Root so `Field.Label` points at the input.
- `Input` renders no caret by default, since the list opens as the user types. `showTrigger` and
  `showClear` add the caret and a clear button, named from the locale dictionary or from
  `triggerLabel` and `clearLabel`. The popup is as wide as the field box.
- `Empty` takes children for the empty list's states, such as loading, an error or no results.
  `Status` is a visually hidden live region for the rest of a search's state. Place it beside the
  input, where it stays mounted while the popup opens and closes.
- `Item`'s `onClick` runs on a click and on Enter, so a picked item can fill another field.
