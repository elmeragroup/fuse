---
"@elmeragroup/fuse": patch
---

`FileTrigger`'s `onSelect` JSDoc (`@elmeragroup/fuse/react-aria/file-trigger`) now says to copy the
picked files, for example `[...files]`, before storing them. The list is the hidden input's own
`files`. Chromium and WebKit empty that list when the picker opens again, so a stored list goes
empty on the next pick. Firefox keeps it.
