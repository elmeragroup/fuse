---
"@elmeragroup/fuse": patch
---

`Item.Separator` inside `Item.Group` is now hidden from assistive technology, so the group's list
owns only list items; outside a group it stays a `separator`. `Code` takes the `region` role only
when it has an `aria-label` or `aria-labelledby`, and stays a keyboard-scrollable tab stop without
one.
