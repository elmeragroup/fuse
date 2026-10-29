---
"@elmeragroup/fuse": minor
---

`DataTableFilter` value lists can end in a footer of actions. `DataTableFilter.ValuesFooter`
holds `SelectAllValues`, `ClearValues` and `Done`. Render one footer component in
`DataTableFilter.FieldList`'s children for the add menu's value submenus, and in
`DataTableFilter.OptionEditor`'s children for a chip's value popover. Its `fields` prop names the
fields whose lists show it, and an id the Root's `fields` lacks throws
`DataTableFilterCompositionError` with the new `unknown-field` rule. A footer part outside a value
list throws the new `outside-value-list` rule.

Select all picks every option of the field, past the 50 rows the list shows. With a search it
picks every option the search matches. It keeps the values already picked, and the operator
follows the count, so `is` becomes `is any of` and a negated operator stays negated. It is disabled
once every option in its scope is picked. A boolean or single-select field leaves it out. Clear
all removes only that field's filter and keeps the list open. Done closes the add menu or the
value popover. Disabled actions stay focusable, and the footer stays in view below the scrolling
list. The dictionary has new `selectAll`, `clearValues` and `done` rows in every locale.

`FieldList` now takes `children`, and `OptionEditor` now renders its children below its list.
Without a footer, both lists render and behave as before.
