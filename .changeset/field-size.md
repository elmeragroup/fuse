---
"@elmeragroup/fuse": minor
---

Every text-entry field takes `size`, `"default"` or `"sm"`, as `Select.Trigger` does: `Input`,
`Textarea`, `TextField`, `TextareaField`, `SelectField`, `NumberField`, `PhoneNumberField`,
`InputGroup.Root`, `Combobox.Input`, `Combobox.Chips`, `Autocomplete.Input`, and from
`react-aria/*` `SearchField`, `DateField`, `DateInput`, `DatePicker` and `DateRangePicker`.
`"default"` is the md control size and renders as before. `"sm"` is the sm control size: the box
is as tall as an sm `Button` or `Select.Trigger`, with the sm inset and a fixed 14px text, so a
search field beside a row of sm controls lines up with them. Before, every field box was pinned to
the md size. The input, steppers, addons, segment rows and inner buttons follow the box's size;
on a touch screen the text keeps its 16px floor at both sizes. The box carries `data-size`.

**Breaking:** on `Input`, `TextField`, `Combobox.Input` and `Autocomplete.Input`, `size` now takes
`"default"` or `"sm"` in place of the native numeric `size` attribute, so `<Input size={20} />`
no longer type-checks. Set the width with a class, such as `w-48`. `InputGroup.Input` keeps the
native attribute, because its group's `size` sets its size.

`SearchField`'s clear button is now a square as tall as the box's inner buttons, 32px in a dense
default field, where it was 24px wide.

In a host without Tailwind's preflight, `Combobox.Chips` now counts its border in its height and
its input drops the browser's own border, padding and fill, so the chips box keeps the field height
there too.
