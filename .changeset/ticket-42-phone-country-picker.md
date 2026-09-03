---
"@elmeragroup/ui": minor
---

Compose PhoneNumberField's country picker from the library `Combobox.Content/List/Item/Empty` instead of a hand-built copy of the same popup, and simplify the state hook (phone-number-field.md §8.15–§8.17).

The popup now takes the family's chrome, so its rendered classes change: it loses `p-2` and gains the shared `max-h-(--available-height)` + `overflow-hidden` (it previously grew to the full list height), the popup search box takes the shared compact `m-1 mb-0` chrome instead of a local `mb-2`, the list takes the shared height clamp, the empty row takes the shared hidden/flex pair, and options pick up the `[&_svg:not([class*='size-'])]:size-4` and `data-highlighted:**:text-accent-foreground` rules the copy had missed. `Combobox.Content` pins an anchored popup's minimum width to the anchor, so the old `max-w-72` cap is gone and the popup is the width of the field. Root, the flag trigger, and the search input are unchanged raw base-ui primitives, and every other emitted class set is byte-identical. New `data-slot` values appear on the popup, list, items, and empty row.

A controlled keystroke now runs one libphonenumber parse instead of three, and country names are resolved once per locale rather than once per row per render. No public API changes.
