---
"@elmeragroup/ui": patch
---

Tests and spec text only: the §7 keyboard scenarios that were specified but untested now have browser tests — Combobox Escape and chip Arrow/Delete navigation, DropdownMenu Enter/Space/ArrowUp opening plus disabled-item behaviour, Collapsible tab order and a disabled Root, Popover Enter/Space, and Item Enter/Space activation. The Combobox invalid ring is asserted as a colour rather than an attribute. DropdownMenu §7/§9 are corrected to the disabled-item behaviour base-ui actually ships (arrow-reachable, never activatable — see dropdown-menu.md §8.11).

Still outstanding (2026-09-03): PhoneNumberField's §7 "Escape closes the country popup" scenario has no keyboard test. It was the one listed scenario left undone here because `phone-number-field.browser.test.tsx` was being edited concurrently; it belongs to that component's next change.

No runtime code changes.
