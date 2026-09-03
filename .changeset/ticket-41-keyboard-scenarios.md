---
"@elmeragroup/ui": patch
---

Tests and spec text only: the §7 keyboard scenarios that were specified but untested now have browser tests — Combobox Escape and chip Arrow/Delete navigation, DropdownMenu Enter/Space/ArrowUp opening plus disabled-item behaviour, Collapsible tab order and a disabled Root, Popover Enter/Space, and Item Enter/Space activation. The Combobox invalid ring is asserted as a colour rather than an attribute. DropdownMenu §7/§9 are corrected to the disabled-item behaviour base-ui actually ships (arrow-reachable, never activatable — see dropdown-menu.md §8.11). No runtime code changes.
