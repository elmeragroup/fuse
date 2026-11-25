---
"@elmeragroup/fuse": patch
---

A Fuse part inside `SkeletonReveal` keeps its skeleton role when it takes a custom `data-slot`. A
`<Button data-slot="pay-invoice">` now draws as one block, as a Button with its own slot does,
instead of a bar over its label. The same holds for every part the skeleton draws as one block or
leaves out, such as `Avatar`, `Badge`, `Input`, `Switch` and `Loader`, and for Fuse parts that
render one of them under their own slot, such as `Sidebar.Trigger`. These parts now write a
`data-skeleton-part` attribute, except `Textarea`, `Emoji` and `Sparkline`, whose `textarea` or `svg`
element the skeleton already draws as one block.
