---
"@elmeragroup/fuse": minor
---

`SearchField` is a permanent component at `@elmeragroup/fuse/search-field`, also in the root
barrel, built on Fuse's `Field` and `InputGroup`. It registers as a Base UI
Field, so inside a `Form` it submits its value under its `name`, shows the `Form` error under that
name, clears it on an edit or a clear, and takes focus when a submit returns an error for it. It
renders an `<input type="search">` with a leading magnifying glass and a clear button, and its root
carries `data-empty` while the value is empty.

It takes `value`, `defaultValue`, `onChange(value)`, `onSubmit(value)`, `onClear`, `clearLabel`,
`size`, `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired` and a node `errorMessage`. A plain
Enter calls `onSubmit`. With `onSubmit` set, a held Enter's repeats and an Enter with a modifier
also stop the form's submit without calling it. Escape empties a field that holds text and stops
there, so a `Dialog` or `Sheet` around it stays open. The magnifying glass and the clear button sit
in the field box's addons, as the `Combobox` clear button does, and the clear button's icon takes
the addon's muted colour. `className` is a string merged onto the root, which fills its container's
width. Native attributes such as `autoComplete` and `enterKeyHint`, and `style`, `data-*` and the
other DOM attributes, reach the `<input>`, as on `TextField`. The field reads its locale from
`LocaleProvider`.
