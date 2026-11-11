---
"@elmeragroup/fuse": minor
---

New `ActionBar` (`@elmeragroup/fuse/action-bar`): a toolbar of actions on a selection, such as the
checked rows of a `DataTable`, that floats at the bottom of its nearest positioned ancestor while
`ActionBar.Root`'s `count` is above zero. It rises into place and falls away, only fading with
reduced motion, and `offset` sets its distance from that ancestor's bottom. It is one Tab stop
with arrow-key focus between its items, named "Bulk actions" in the reader's locale unless it gets
an `aria-label`, and a polite live region announces the count each time it changes.
`ActionBar.Count` shows the count, `ActionBar.Clear` is the localized "Clear selection" button,
and `ActionBar.Button` with `ActionBar.ButtonLabel` shows its icon alone in a container narrower
than 28rem. When the selection empties with focus in the bar, focus returns to where it came from.
