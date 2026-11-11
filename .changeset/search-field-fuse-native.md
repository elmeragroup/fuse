---
"@elmeragroup/fuse": minor
---

`SearchField` is a permanent component at `@elmeragroup/fuse/search-field`, also in the root
barrel, built on Fuse's `Field` and `InputGroup` instead of React Aria. It registers as a Base UI
Field, so inside a `Form` it submits its value under its `name`, shows the `Form` error under that
name, clears it on an edit or a clear, and takes focus when a submit returns an error for it. It
renders an `<input type="search">` with a leading magnifying glass and a clear button, and its root
carries `data-slot="search-field"` and `data-empty` while the value is empty.

`value`, `defaultValue`, `onChange(value)`, `onSubmit(value)`, `onClear`, `clearLabel`, `size`,
`isDisabled`, `isReadOnly`, `isInvalid` and `isRequired` keep their meaning. Enter calls `onSubmit`
and, only then, stops the form's submit. Escape empties a field that holds text and stops there, so
a `Dialog` or `Sheet` around it stays open. The magnifying glass and the clear button sit in the field
box's addons, as the `Combobox` clear button does, so in comfortable density the glass sits 12px in
from the edge (was 8px) and the clear button 8px (was 4px). Dense density keeps both. In both
densities the query starts closer to the glass, at `InputGroup`'s addon spacing, and the clear
button's icon takes the addon's muted colour, as the `Combobox` clear button's does.

Breaking: `@elmeragroup/fuse/react-aria/search-field` is removed. Import `SearchField` from
`@elmeragroup/fuse/search-field`. `errorMessage` takes a node, not React Aria's
`(validation) => ReactNode` function. `validate`, `validationBehavior`, `onFocusChange`,
`excludeFromTabOrder`, `type`, `slot` and the render-prop forms of `className`, `style` and `children`
are removed. `className` is a string, merged onto the root. `onKeyDown`, `onKeyUp`, `onFocus` and
`onBlur` take React's native events, without React Aria's `continuePropagation`. The other native
input attributes, such as `autoComplete` and `enterKeyHint`, reach the input. A `UiProviders` wrapper
is no longer needed: the field reads its locale from `LocaleProvider`.

Breaking: `@elmeragroup/fuse/react-aria/grid-list`, with `GridList` and `GridListItem`, is removed.
For a single choice from a list of rows, use `RadioItemGroup` and `RadioItem` from
`@elmeragroup/fuse/radio-group`; for several choices, `CheckboxItemGroup` and `CheckboxItem` from
`@elmeragroup/fuse/checkbox`.
