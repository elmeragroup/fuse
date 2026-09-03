---
"@elmeragroup/ui": minor
---

One picker recipe and one picker shell for DatePicker and DateRangePicker, one field-box chrome across both component tiers, and the dead private react-aria modal stack removed.

Two rendered changes, both deliberate: the react-aria field box (DateField, SearchField, both date pickers) moves onto Input's `rounded-md shadow-xs` chrome so a form that mixes the tiers shows one box (date-field.md §8.9), and a read-only picker's trigger glyph loses the `bg-muted` it carried on the `<svg>` itself — the read-only fill is now painted once, by the FieldGroup (date-picker.md §8.11). Everything else emits the same classes part for part.

No public surface changes. The removed `Modal`, `overlay-container`, `DialogOverlay`, `DialogFooter`, `bare` dialog variant and RAC `PopoverTrigger` re-export were package-private with no runtime consumer; a picker hosted in a dialog is the public base-ui `Dialog`, which tracks overlay nesting through the React tree.
