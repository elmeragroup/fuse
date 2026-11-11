---
"@elmeragroup/fuse": patch
---

A vertical `ScrollArea.Root` now lets its content truncate. Before, Base UI's `min-width:
fit-content` made the content at least as wide as its longest line, so a `truncate` child
overflowed the viewport instead of ending in an ellipsis. The content now fills the viewport's
width; a horizontal root still grows its content to the widest line and scrolls across it.
