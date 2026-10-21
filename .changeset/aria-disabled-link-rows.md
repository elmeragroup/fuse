---
"@elmeragroup/fuse": patch
---

An `Item.Root` or `Card.SectionButton` link announced `aria-disabled="true"` no longer navigates. A
link takes no native `disabled`, so the part cancels its own activation: a click or a keyboard
Enter neither follows the link nor runs `onClick`, and a middle-click neither opens a new tab nor
runs `onAuxClick`, as Sidebar's menu rows already did. An `aria-disabled` `Item.Root` now also
dims with the `not-allowed` cursor, and a link row's hover fill skips it.
