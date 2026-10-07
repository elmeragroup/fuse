---
"@elmeragroup/fuse": patch
---

`SelectionItem.Description`, and with it `CheckboxItem.Description` and `RadioItem.Description`,
shows every line. It was `Item.Description`, which clamps to two lines, so on a phone an option's
description was cut with an ellipsis while a screen reader still read the whole label. It is now
the row's own part with the same props and the same `item-description` slot. `Item.Title`,
`SelectionItem.Title` and `Alert.Title` drop a `line-clamp-1` that never applied, because `flex`
overrode it, and with it the `overflow: hidden` it left behind.
