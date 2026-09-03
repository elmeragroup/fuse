---
"@elmeragroup/ui": patch
---

Compose `Select`, `Combobox`, and `DropdownMenu` from the package-private overlay spine — the portal hook, the positioner/container prop types, and the popup surface/motion/duration and menu item/indicator/separator/group-label class constants — and render `DropdownMenu.Content` and `DropdownMenu.SubContent` through one `Portal > Positioner > Popup`. Combobox's `[object String]`/`[object Number]` chip-label check becomes the shared `isTextValueNode`. No public export is added or removed; every migrated part emits the same class set and the same DOM, with the same prop names and documented defaults.
