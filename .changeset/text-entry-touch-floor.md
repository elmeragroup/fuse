---
"@elmeragroup/fuse": patch
---

On a coarse pointer, text-entry fields now show text at 16px or larger. iOS Safari no longer zooms into a
focused field in a dense app. Dense control text is 14px, and iOS zooms into a focused field whose text is
under 16px, then stays zoomed after the field blurs. The floor covers `Input`, `Textarea`, `InputGroup.Input`,
`InputGroup.Textarea`, `TextField`, `TextareaField`, `NumberField`, `PhoneNumberField`, `Combobox.Input`,
`Combobox.ChipsInput`, `Sidebar.Input`, `SearchField`, `DateField`, `DatePicker` and `DateRangePicker`.
Comfortable 18px text is unchanged, and a fine pointer keeps 14px dense text. A font-size class in `className`
still sets the size on every pointer, the floor included, so a field given `text-sm` keeps 14px on touch
screens.
