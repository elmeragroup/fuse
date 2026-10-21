---
"@elmeragroup/fuse": patch
---

An `Item.Root` or `Card.SectionButton` link announced `aria-disabled="true"` no longer navigates. A
link takes no native `disabled`, so the part cancels its own activation: a click or a keyboard
Enter neither follows the link nor runs `onClick`, and a middle-click neither opens a new tab nor
runs `onAuxClick`, as Sidebar's menu rows already did. `Item.Root` cancels only on a `render` row,
so the controls inside a plain row keep their clicks. Any `Item.Root` announced `aria-disabled` now
dims with the `not-allowed` cursor, as a disabled button row does, and a link row's hover fill
skips it.
