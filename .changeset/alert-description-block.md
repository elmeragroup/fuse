---
"@elmeragroup/fuse": patch
---

`Alert.Description` now renders a `div` instead of a `p` and no longer clamps its text to two
lines. An alert can hold several paragraphs or a list, and every line stays visible.
`Alert.Description` puts an 8px gap between consecutive block children, so a list sits apart
from the paragraph above it. `AlertDescriptionProps` now takes `div` props. `Item.Description`
keeps its `p` element and two-line clamp.
