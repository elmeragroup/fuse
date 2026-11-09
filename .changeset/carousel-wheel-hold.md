---
"@elmeragroup/fuse": patch
---

A trackpad or wheel gesture on a `Carousel` now counts as one held input, from its first turn to
two frames after its last. Before, a gesture that turned every frame was released and held again
every other frame, so the carousel took and dropped its document listeners for the whole gesture.
