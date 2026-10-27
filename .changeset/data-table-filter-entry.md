---
"@elmeragroup/fuse": minor
---

New `@elmeragroup/fuse/data-table-filter` entry, a filter bar for TanStack Table v9 tables. Install
`@tanstack/react-table` 9.2 or later beside Fuse. It is an optional peer, and the entry is not in the
root barrel.

- `DataTableFilter.Root` reads and writes the table's `columnFilters`. Each filter value is a plain
  `{ kind, operator, values }` object for an option, multi-option, text, number, date or boolean
  field.
- `defineFilterFields<Row>()` describes the filterable columns, keyed by column id and checked against
  the row type. `createDataTableFilterFn({ timeZone })` returns the one filter function every column
  uses.
- `Bar` holds the Trigger, a chip per filter and Clear. `Content` is the add menu, with a field
  search, value submenus, quick search across option values, and text, number and date editors that
  open in place. `ValueContent` is the popover a chip's value opens.
- The bar stays one line high at every width. Its chips sit in one strip that scrolls sideways,
  also under a vertical mouse wheel, and an end of the strip fades only while chips hide past it.
  The fades are scroll-linked animations that never finish, so a test helper that waits for
  animations should wait only for those on the document timeline. The Trigger is a square icon button named "Filter" at every width. Below a 36rem bar width Clear
  shows only its icon and keeps its accessible name.
- A list of values shows its first 50 matches and asks for more typing.
- A `boolean` field kind filters `true` and `false`. `toggle: true` makes it an on/off scope with a
  checkbox row in the add menu and a chip that is its name and Remove.
- Text fields can opt in to `startsWith` and `doesNotStartWith`. `formatOperator` receives the
  field id, so one field can relabel an operator.
- A field's `operators` bound every filter the bar writes. An option field without a multi-value
  operator is single-select, and a date field without `isBetween` offers only its one-day presets,
  written as `is`.
- A date field picks its presets from a catalog with `presets`. Each period preset covers its whole
  calendar period, with weeks starting on the locale's first day.
- With `manualFiltering`, pass server counts and ranges through `facets`. `parseColumnFilters` and
  `matchesFilter` parse and match the same values on a server.
- `DateEditor` takes a function child that replaces its date inputs, for example with a calendar. On
  a viewport 40rem wide or more, the presets stand in a column beside the child, and the popup widens
  to fit.
- `useDataTableFilter().actions.edit(fieldId)` opens a field's editor, and `onActiveFieldChange`
  reports the field whose submenu or editor opens.
