---
"@elmeragroup/fuse": patch
---

Repair badge and secondary text colors across themes, wrap horizontal cards and pagination, and fit date pickers to narrow containers. Disabled InputGroup addon buttons no longer dim an editable field. Destructive confirmations focus Cancel, mobile sidebars expose a close button, and calendars follow the locale direction and choose weekday labels by width — a locale whose short names overflow a column falls back to narrow glyphs.

Follow-up to the same review pass:

- `Button` with `isVisuallyDisabled` now stamps `aria-disabled="true"` so the unavailable state is announced; an explicit `aria-disabled` prop still wins.
- `Dialog.Title` accepts `isFocusable`, which stamps `tabIndex={-1}` and the shared focus ring — the supported way to hand a long-content title to `initialFocus`.
- `AlertDialog.Content` honors a caller's `initialFocus` over its variant default, and the mobile `Sidebar` close button now sits in a normal-flow header row instead of an absolutely positioned overlay.
- The typography `secondary` variant is deprecated: it is an identity alias of `foreground` (`--secondary` is a surface token, never a text role).
