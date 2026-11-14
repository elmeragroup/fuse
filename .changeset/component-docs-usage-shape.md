---
"@elmeragroup/fuse": patch
---

`Form` now documents its submit rules on the props they concern. `errors` lists which fields show
the messages, when an error blocks the submit and when the form clears it. `onFormSubmit` lists the
values it receives and when the form skips it.

`ActionBar`, `Badge`, `ButtonGroup`, `ConfirmButton`, `Kbd`, `Link`, `Loader`, `Separator`,
`AspectRatio`, `Emoji` and `Code` now document their rules on the props they concern, so the API
reference and the markdown endpoint show them. `ActionBar.Root` documents its live announcement and
focus return on `count` and its placement on `offset`. `Link` documents `href`, `target`, `render`,
`underline`, `weight` and `truncate`. `Kbd` documents `aria-hidden` for a cap that repeats a
shortcut. `Badge`, `ConfirmButton`, `Link` and `Loader` declare the defaults they already had, so
the API reference shows them.

`Heading`, `Text`, `Span`, `Card`, `Frame`, `Item`, `DescriptionList`, `Empty`, `Show`, `ScrollArea`
and `TimelineList` now document their rules on the props they concern. `Heading` documents how
`size` and `font` replace a level's theme type. `Card.Root` documents its parts on `children` and
its edge and shadow overrides on `className`, and `Card.SectionButton` documents links, triggers
and `aria-disabled`. `Frame.Root` and `Frame.Panel` document which children the Frame lays out and
when a panel drops its padding for a table. `Item.Root` documents link rows and `aria-disabled`.
`DescriptionList` documents its Item content model and long values on `children`. `ScrollArea.Root`
documents fixed and max heights on `className`. `Text` and `Span` declare the `variant`, `size`
and `weight` defaults they already had, and `Span` its `snug` leading, so the API reference shows
them.

`Alert`, `AlertDialog`, `Dialog`, `Sheet`, `Popover`, `PopoverInfoButton`, `Tooltip`, `Toast`,
`DropdownMenu` and `Command` now document their rules on the props they concern. `Alert.Root`
documents its live-region `role` and its text parts on `children`. `AlertDialog.Content`
documents its initial focus on `variant` and when to close on `isAutomaticallyCloseOnActionEnabled`.
`Dialog.Content` and `Sheet.Content` document each `size`, and `Sheet.Content` says the size applies
only to the left and right sides from `sm` up. `Popover.Content` documents the trigger's role
beside `anchor`. `PopoverInfoButton` documents its trigger `size` and its `label`. `Tooltip`
documents shared and own delays. `Toast.Provider` documents one provider and viewport per app on
`children`, `Toast.useToastManager` documents the `promise` lifecycle and its returned promise,
and `Toast.Close` names the `overlay.close` dictionary entry it reads.
`DropdownMenu.Group` documents its label on `children`, `inset` says it lines text up with items
that start with an icon, and `DropdownMenu.RadioGroup` says its
`value` type does not check item values. `Command` documents its search, stack, dialog, list,
status and shortcut rules on `open`, `onOpenChange`, `pages`, `defaultPages`, `items`, `value`,
`defaultValue`, `autoHighlight`, `virtualized`, `Command.Content`'s `aria-label` and `children`, `Command.Input`'s `aria-label` and
`placeholder`, `Command.List`'s `children` and `render`, `Command.Empty`'s and `Command.Status`'s
`children`, `Command.Item`'s `onClick` and `Command.Shortcut`'s `children`. `Dialog.Content` and
`Sheet.Content` declare the `md` size default they already had, so the API reference shows it.

`Accordion`, `Collapsible`, `Tabs`, `Breadcrumb`, `NavigationMenu`, `Pagination`, `Sidebar`,
`Toolbar`, `Carousel` and `ListDetail` now document their rules on the props they concern.
`Accordion.Root` documents each `variant` and `radius`, and `Accordion.Trigger` how to style a
custom `indicator`. `Collapsible.Content` documents the `className` that turns off its clipping and
height transition. `Tabs.List` documents `variant` and its `activateOnFocus` default.
`Breadcrumb.Link` and `NavigationMenu.Link` document router links on `render`. `NavigationMenu`
documents its landmark name on `aria-label`, its keyboard on `Trigger`'s `children`, its inline
submenus on `inline` and its indicator on `children`. `Pagination.Content` documents wrapping in a
narrow container. `Toolbar` documents its focus order on `loopFocus`, `disabled` and
`orientation`, and how buttons, inputs, menus and tooltips join it on `render`. `Sidebar.Root`
documents how to compose a right sidebar on `side`. `Sidebar.Provider`
documents on `defaultOpen` that it reads the value once, so a flash-free restore reads the cookie
in a server layout and passes it there, and it documents the mobile Sheet on `openMobile`, `Sidebar.Root` where its
element props land on `style`, `Sidebar.Inset` its landmark on `render`, and `Sidebar.MenuButton`
and `Sidebar.MenuSubButton` their `aria-disabled` rows and sizes. `Carousel` documents its name,
parts, slide sizing, inert slides, controls order, thumbnails, page count, reduced motion and the
full automatic rotation lifecycle on the props they concern, and `useCarousel` lists its state and actions.
`ListDetail` documents its layout, server render and focus moves on `split` and `onOpenChange`, its
empty state and remount on `Detail`'s `children`, and the Sheet-only `size`, `showCloseButton`,
`closeLabel` and `Close` `render`. `Toolbar.Root` declares its `orientation`, `loopFocus` and
`disabled` defaults, `Toolbar.Button` and `Toolbar.Group` their `disabled` default and
`NavigationMenu.Link` its `active` default, `Carousel.Previous` and `Carousel.Next` their
`icon-sm` size default and `Command.Root` and `Command.Page` their `virtualized` default, all values
they already had, so the API reference shows
them. The public types are unchanged.

`Checkbox`, `CheckboxCard`, `RadioGroup`, `Switch`, `Toggle`, `ToggleGroup`, `SelectionItem`,
`Slider`, `Meter` and `Avatar` now document their rules on the props they concern.
`CheckboxGroup` and `RadioGroup` document `orientation`, `allValues` and the options they take on
`children`, and on `value` and `defaultValue` that the group, not a member's `defaultChecked`,
decides which members are checked. `CheckboxCard` says the same on `value`. `CheckboxItem`,
`RadioItem` and `SelectionItem.Shell` document on `className` where to
set the `--selection-*` theme roles, on `children` how a server component writes the row, and
`SelectionItem.Shell` documents an icon beside the control on `control`. `CheckboxCard`,
`Toggle` and `ToggleGroup` document `variant` and `size`. `Slider` documents vertical height,
`onValueCommitted` for saving and a NumberField for exact values. `Meter` documents each `mode`
and its levels. `Avatar.Root` documents `size-*` on `className`, `Avatar.Image` documents `alt`,
and `Avatar.Group` its stacking on `children`. `CheckboxItem` and `RadioItem` declare their
`isSubSectionSelectable` default, and `Slider` and `Meter` their range and step defaults, all
values they already had, so the API reference shows them. The public types are unchanged.

`Field`, `Input`, `InputGroup`, `Textarea`, `TextField`, `TextareaField`, `NumberField`,
`SearchField` and `PhoneNumberField` now document their rules on the props they concern.
`Field.Root` documents each `orientation`, and that a responsive root needs a `Field.Group`.
`Field.Error` documents on `children` when it shows its own message and where to place it,
`Field.Description` whether it describes a field or a set, `Field.Set` its `aria-describedby`
and `disabled`, `Field.Legend` a native legend in a grid set on `render`, and `Field.Label` the
choice row and choice card on `children`. `Input`, `Textarea` and `InputGroup.Input` document on
`aria-label` how to give them a visible label, and `Textarea` that it takes a `Field.Root`'s
wiring only through `Field.Control`'s `render`. `InputGroup.Root` documents on `children` that
its state comes from its direct input or textarea, and `InputGroup.Addon` documents `align` and
what an addon holds. `NumberField` documents `onChange` against `onValueCommitted` and the locale
behind `formatOptions`, `SearchField` its Enter, Escape and clear button behaviour, and
`PhoneNumberField` country detection and how a controlled country answers a proposal.
`TextField` declares its `size` default, and `PhoneNumberField` its `defaultCountryCode`,
`autoDetectCountry`, `international`, `preserveOnCountryChange`, `outputFormat` and `formatOnType`
defaults, all values they already had, so the API reference shows them. The public types are
unchanged.

`Select`, `SelectField`, `Combobox`, `ComboboxField`, `Autocomplete`, `AutocompleteField`,
`Attachment`, `FileTrigger` and `FileUpload` now document their rules on the props they concern.
`Select.Content` documents when `alignItemWithTrigger` places the popup over the trigger and when
it falls back to `side`. `Combobox.Content` documents its default anchor on `anchor`, and
`Combobox.Input` and `Autocomplete.Input` when their clear button shows. `SelectField`, `ComboboxField` and `AutocompleteField` document where the
label, error and description sit, how `Form` errors under `name` show and clear, what read-only
still submits, and when to compose `Field.Root` and the parts instead. `SelectField` documents its
`ref`, which goes to the trigger. `Autocomplete.Root` documents its text value, the picked item's
text, `name` and `id` inside a `Field`, and `filter={null}` for a search that runs on a server.
`Autocomplete.Item` documents `onClick` for capturing the picked item, and `Autocomplete.Empty`
and `Autocomplete.Status` their live regions on `children`. `AutocompleteField` documents the same
on `value`, `onValueChange`, `filter` and `itemToStringValue`, and groups on `items` and
`children`. `FileUpload.Root` documents every rejection reason on `onReject`, app limits on
`onSelect`, posting with a form on `name` and `files`, Field validation on `required`, folders on
`directory`, and paste, the document drop guard and `useFileUpload()` on `children`.
`FileUpload.Trigger` documents its Field label, id, description order and invalid face, and
`FileUpload.Dropzone` and `FileUpload.Description` their rules on `children`. `FileTrigger`
documents on `children` that it joins a `ButtonGroup` as a `Button` does. `Attachment.Root`
documents each `size`, `orientation` and `state` and its parts on `children`, `Attachment.Media`
documents `variant`, `Attachment.Group` its name and scrolling, `Attachment.Action` and
`Attachment.Trigger` their names, and `Attachment.Trigger` links and dialogs on `render`.
`SelectField` declares its `size` default, a value it already had, so the API reference shows it.
The public types are unchanged.

`Calendar`, `RangeCalendar`, `DateField`, `DateInput`, `DatePicker`, `DatePickerField`,
`DateRangePicker`, `DateRangePickerField`, `DataTable`, `DataTableFilter`, `Table`,
`VerticalTable`, `Skeleton` and `SkeletonReveal` now document their rules on the props they
concern. `Calendar.Root` and `RangeCalendar.Root` document their name on `aria-label` and
`aria-labelledby`, their parts on `children`, the server render and today's month on
`defaultValue`, and the bound names on `minValue` and `maxValue`. Every date component's `value`
points to the Temporal polyfill and TypeScript lib setup in the quick start. The calendar parts document the
live heading on `VisibleRangeHeading`'s `children`, a one-month heading on `MonthHeading`'s, the
day names and keys on `DayButton`'s, the range flags on `DayGridCell`'s `className`, and canceling
a page on the month buttons' `onClick`. `RangeCalendar.Root` documents choosing a range and its
reasons on `onValueChange`, and its state attributes on `className`. `DateField`,
`DatePickerField` and `DateRangePickerField` document their keys, kinds, time zones, bounds,
`Form` posting and segment names on the props they concern, and `DateInput.Root` its `Field`
wiring on `name` and its segments on `children`. `DatePicker.Root` documents its parts and
`TimeInput` on `children` and focus on `onOpenChange`, and `DatePicker.Presets` who clears the
checked preset on `value` and `defaultValue`. `DateRangePicker.Label`, `Description` and `Error`
document their `children`. `DataTable.Pagination` documents a stable `data`, `total` and page size
changes, and `DataTable.RowActions` its own `label`. `DataTableFilter.Root` documents the fields
map, its parts and `actions.edit` on `fields` and `children`, the filter function on `table`, and `Bar`, `Content`, `Editor`,
`ValuesFooter` and `DateEditor` their behaviour on `children`. `Table.Row` documents
`data-state="selected"`, `Skeleton` documents `aria-busy` on `className`, and `SkeletonReveal`
documents how it draws, its focus and form rules and its markers on `children`. The month buttons
declare their `icon` size and `ghost` variant, and `DatePickerField` and `DateRangePickerField`
their `visibleMonths`, `pageBehavior` and `shouldCloseOnSelect` defaults, and
`DateRangePickerField` its `size` default, values they already had, so the API reference shows
them. The public types are unchanged.

`Chart`, `BarChart`, `LineChart`, `AreaChart` and `ScatterChart` now document their rules on the
props they concern. `Chart.Root` documents its keys on `defaultActiveX` and `orientation`, stacks,
series intervals, scales and threshold colours on `config`, the server render on `data`, a late
`Bar` on `data-intro`, references outside the data on `yInclude`, and `--surface` and
`--chart-hover-dim` on `style`. `Chart.Panel` documents where each part goes, `Chart.Tooltip` its
placement, glide and dismissal on `anchor`, `Chart.Crosshair` its width and glide on `variant`, and
`Chart.ActiveDot`, `Chart.SlotLabel`, `Chart.LegendToggleGroup` and the table button their motion
or keys. `Chart.Bar`, `Chart.Line` and `Chart.Area` document their looks, readings, updates and
curves on `dataKey` and `curve`. `ScatterChart.Root` documents its keys on `children`, its option
on `xLabel`, axis motion on `data` and references outside the domains on `xInclude` and
`yInclude`, and `ScatterChart.Points` and `ScatterChart.Line` their paths and fitted lines on
`dataKey`. The `curve` docs no longer promise a vertical tangent under `"monotone-y"`, the table
button says the table stays out of the Tab order only while collapsed, and `Chart.Bar` and config
`barVariant` say that only a vertical chart draws more than 100 slots as one path. The public types
are unchanged.

Fixed: in a horizontal `CheckboxGroup`, `RadioGroup`, `CheckboxItemGroup` or `RadioItemGroup`, each
`CheckboxItem`, `RadioItem` or `SelectionItem.Shell` card filled the line, so the cards stacked.
The cards now share the line in equal widths, and a `basis-*` class on a row sets the width below
which it wraps. Vertical groups and `Item` are unchanged.
