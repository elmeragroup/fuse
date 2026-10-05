---
"@elmeragroup/fuse": patch
---

`Sidebar.MenuButton` no longer shows a stale tooltip when the rail collapses. Before, hovering or
focusing a button with a `tooltip` while the rail was expanded opened its `Tooltip.Root` and only
withheld the content, so collapsing the rail showed that tooltip at once. The root is now disabled
while the rail is expanded or on mobile, so the tooltip opens only when the pointer or focus
reaches the button in the collapsed rail. The button stays mounted across the toggle and keeps
focus on ⌘B.
