---
"@elmeragroup/fuse": patch
---

`Badge` now renders an inline-flex `span` instead of a `div`, so it is valid inside a
paragraph such as `Item.Description` and `SelectionItem.Description`. Before, server HTML with a
Badge inside one of those parsed with the badge outside the paragraph. `BadgeProps` now takes
`span` props.
