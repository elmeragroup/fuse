---
"@elmeragroup/fuse": patch
---

Dragging a `Slider` thumb no longer re-attaches each thumb's range input and rewrites its
focus-ring attribute on every value change. `Button`'s `onIntent` prediction skips the layout read
of every registered button far outside the viewport, so a long list of prefetching buttons costs
a pointer move only for the ones on screen.
